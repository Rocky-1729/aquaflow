import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { 
  UserRole, 
  OrderStatus, 
  User, 
  Order, 
  DeliveryPersonnel, 
  SystemStats, 
  PaymentMethod, 
  SubscriptionFrequency, 
  SubscriptionContract, 
  ComplaintTicket, 
  OrderReview 
} from './src/types.js';

// Configuration
const PORT = 3000;
const JWT_SECRET = 'watercan_super_secret_jwt_key_2026';
const DB_FILE = path.join(process.cwd(), 'db_data.json');

// Get Gemini instance
let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

// Core Coordinates (Central Hub - Hyderabad / generic layout)
const DEPOT_LAT = 17.4062;
const DEPOT_LON = 78.4680;

// Database Interface
interface DatabaseSchema {
  users: Array<User & { passwordHash: string; verificationCode?: string; resetPasswordCode?: string; isVerified?: boolean }>;
  orders: Order[];
  deliveryPersonnel: DeliveryPersonnel[];
  pricing: { costPerCan: number };
  subscriptions: SubscriptionContract[];
  complaints: ComplaintTicket[];
  reviews: OrderReview[];
  paymentConfig?: {
    qrCodeUrl: string;
    upiId: string;
    enabledMethods: string[];
    accountDetails?: string;
  };
}

// Initial/Seed Database
const initialDatabase = (): DatabaseSchema => {
  const adminSaltAndHash = bcryptjs.hashSync('owner123', 10);
  const deliverySaltAndHash = bcryptjs.hashSync('delivery123', 10);
  const customerSaltAndHash = bcryptjs.hashSync('customer123', 10);

  return {
    users: [
      {
        id: 'user_admin',
        name: 'Aravind Rao (Platform Administrator)',
        email: 'admin@aquaflow.com',
        phone: '9000100020',
        address: 'AquaFlow HQ, Gachibowli, Hyderabad',
        role: UserRole.ADMIN,
        createdAt: new Date().toISOString(),
        passwordHash: adminSaltAndHash,
        isVerified: true
      },
      {
        id: 'user_owner',
        name: 'Venkatesh (Vendor Owner)',
        email: 'owner@watercan.com',
        phone: '9876543210',
        address: 'AquaFlow Central Distribution Depot, Main Road',
        role: UserRole.OWNER,
        createdAt: new Date().toISOString(),
        passwordHash: adminSaltAndHash,
        isVerified: true
      },
      {
        id: 'user_delivery_1',
        name: 'Ravi Kumar (Agent 1)',
        email: 'delivery1@watercan.com',
        phone: '9988776655',
        address: 'Secunderabad Area Hub',
        role: UserRole.DELIVERY,
        createdAt: new Date().toISOString(),
        passwordHash: deliverySaltAndHash,
        isVerified: true
      },
      {
        id: 'user_delivery_2',
        name: 'Sandeep Singh (Agent 2)',
        email: 'delivery2@watercan.com',
        phone: '8877665544',
        address: 'Hitech City Area Hub',
        role: UserRole.DELIVERY,
        createdAt: new Date().toISOString(),
        passwordHash: deliverySaltAndHash,
        isVerified: true
      },
      {
        id: 'user_customer_1',
        name: 'Ananya Rao',
        email: 'customer@watercan.com',
        phone: '7766554433',
        address: 'Gachibowli High-Rise Enclave, Flat 402, Hyderabad',
        role: UserRole.USER,
        createdAt: new Date().toISOString(),
        passwordHash: customerSaltAndHash,
        isVerified: true
      },
    ],
    orders: [
      {
        id: 'order_101',
        userId: 'user_customer_1',
        userName: 'Ananya Rao',
        userPhone: '7766554433',
        userAddress: 'Gachibowli High-Rise Enclave, Flat 402, Hyderabad',
        quantity: 3,
        price: 15, // 3 * $5
        status: OrderStatus.DELIVERED,
        deliveryId: 'user_delivery_1',
        deliveryName: 'Ravi Kumar (Agent 1)',
        deliveryPhone: '9988776655',
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // Yesterday
        paymentMethod: PaymentMethod.RAZORPAY,
        isPaid: true
      },
      {
        id: 'order_102',
        userId: 'user_customer_1',
        userName: 'Ananya Rao',
        userPhone: '7766554433',
        userAddress: 'Gachibowli High-Rise Enclave, Flat 402, Hyderabad',
        quantity: 2,
        price: 10,
        status: OrderStatus.PENDING,
        deliveryId: null,
        deliveryName: null,
        deliveryPhone: null,
        createdAt: new Date().toISOString(),
        paymentMethod: PaymentMethod.COD,
        isPaid: false
      },
    ],
    deliveryPersonnel: [
      {
        id: 'user_delivery_1',
        name: 'Ravi Kumar (Agent 1)',
        phone: '9988776655',
        currentLatitude: DEPOT_LAT,
        currentLongitude: DEPOT_LON,
        isAvailable: true,
      },
      {
        id: 'user_delivery_2',
        name: 'Sandeep Singh (Agent 2)',
        phone: '8877665544',
        currentLatitude: DEPOT_LAT + 0.005,
        currentLongitude: DEPOT_LON - 0.005,
        isAvailable: true,
      },
    ],
    pricing: {
      costPerCan: 5.0, // Default cost is $5.00/can
    },
    subscriptions: [
      {
        id: 'sub_301',
        userId: 'user_customer_1',
        quantity: 2,
        frequency: SubscriptionFrequency.WEEKLY,
        pricePerCan: 5.0,
        totalPrice: 10.0,
        address: 'Gachibowli High-Rise Enclave, Flat 402, Hyderabad',
        isActive: true,
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        paymentMethod: PaymentMethod.G_PAY,
      }
    ],
    complaints: [
      {
        id: 'ticket_501',
        orderId: 'order_101',
        userId: 'user_customer_1',
        customerName: 'Ananya Rao',
        subject: 'Slight delay in delivery',
        message: 'The rider was about 15 minutes late than the estimated ETA on the dashboard.',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      }
    ],
    reviews: [
      {
        id: 'rev_401',
        orderId: 'order_101',
        userId: 'user_customer_1',
        customerName: 'Ananya Rao',
        rating: 4,
        comments: 'Water quality was premium, although slightly late delivery.',
        createdAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
      }
    ],
    paymentConfig: {
      qrCodeUrl: 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=300&auto=format&fit=crop',
      upiId: 'aquaflow@ybl',
      enabledMethods: ['COD', 'G_PAY', 'PHONE_PE', 'PAYTM', 'UPI', 'BANK_TRANSFER'],
      accountDetails: 'AquaFlow Enterprises, HDFC Bank, A/C: 50200012345678, IFSC: HDFC0000123'
    },
  };
};

// Database state
let db: DatabaseSchema;

const loadDatabase = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
      // Validate structure in case of older files
      if (!db.users || !db.orders || !db.deliveryPersonnel) {
        db = initialDatabase();
        saveDatabase();
      }
      if (!db.subscriptions) db.subscriptions = [];
      if (!db.complaints) db.complaints = [];
      if (!db.reviews) db.reviews = [];
      if (!db.paymentConfig) {
        db.paymentConfig = {
          qrCodeUrl: 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=300&auto=format&fit=crop',
          upiId: 'aquaflow@ybl',
          enabledMethods: ['COD', 'G_PAY', 'PHONE_PE', 'PAYTM', 'UPI', 'BANK_TRANSFER'],
          accountDetails: 'AquaFlow Enterprises, HDFC Bank, A/C: 50200012345678, IFSC: HDFC0000123'
        };
      }
    } else {
      db = initialDatabase();
      saveDatabase();
    }
  } catch (error) {
    console.error('Failed to load database, using seeded fallback', error);
    db = initialDatabase();
  }
};

const saveDatabase = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save database to disk', error);
  }
};

// Initial database loading
loadDatabase();

// Express setup
const app = express();
app.use(express.json());

// Express/Server configuration (Allow cross-origin in dev)
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Authentication middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: 'Token is invalid or expired' });
    }
    req.user = decoded;
    next();
  });
};

// Check role middleware
const requireRole = (roles: UserRole[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }
    next();
  };
};

/* ================== API ROUTES ================== */

// 1. Auth Endpoint: Register Customer
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, address, role } = req.body;

  if (!name || !email || !password || !phone) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ message: 'Email address already registered' });
  }

  const userRole = role && Object.values(UserRole).includes(role) ? role : UserRole.USER;

  const id = 'user_' + Math.random().toString(36).substr(2, 9);
  const passwordHash = bcryptjs.hashSync(password, 10);
  const verificationCode = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code

  const newUser: User & { passwordHash: string; verificationCode: string; isVerified: boolean } = {
    id,
    name,
    email,
    phone,
    address: address || '',
    role: userRole,
    createdAt: new Date().toISOString(),
    passwordHash,
    verificationCode,
    isVerified: false, // Must verify code
  };

  db.users.push(newUser);

  // If registering as a delivery personnel, automatically add to the tracking list
  if (userRole === UserRole.DELIVERY) {
    db.deliveryPersonnel.push({
      id: newUser.id,
      name: newUser.name,
      phone: newUser.phone,
      currentLatitude: DEPOT_LAT + (Math.random() - 0.5) * 0.01,
      currentLongitude: DEPOT_LON + (Math.random() - 0.5) * 0.01,
      isAvailable: true,
    });
  }

  saveDatabase();

  const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  const { passwordHash: _, verificationCode: __, ...clientUser } = newUser;
  res.status(201).json({ token, user: clientUser, verificationCode }); // Provide code in response so clients can immediately auto-fill or inspect
});

// 1.1 Verify Account
app.post('/api/auth/verify', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ message: 'Email and verification code are required' });
  }
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (user.verificationCode !== code) {
    return res.status(400).json({ message: 'Invalid verification code. Please check your simulated inbox.' });
  }
  user.isVerified = true;
  delete user.verificationCode;
  saveDatabase();

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
  const { passwordHash: _, ...clientUser } = user;
  res.json({ message: 'Email verified successfully', token, user: clientUser });
});

// 1.2 Resend Verification
app.post('/api/auth/resend-verification', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const newCode = Math.floor(1000 + Math.random() * 9000).toString();
  user.verificationCode = newCode;
  saveDatabase();
  res.json({ message: 'Verification code resent', verificationCode: newCode });
});

// 1.3 Forgot Password
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  user.resetPasswordCode = code;
  saveDatabase();
  res.json({ message: 'Password recovery OTP code generated', recoveryCode: code });
});

// 1.4 Reset Password
app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'All parameters (email, code, newPassword) are required' });
  }
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (user.resetPasswordCode !== code) {
    return res.status(400).json({ message: 'Incorrect recovery OTP code' });
  }
  user.passwordHash = bcryptjs.hashSync(newPassword, 10);
  delete user.resetPasswordCode;
  saveDatabase();
  res.json({ message: 'Password updated successfully. You can now login.' });
});

// 1.5 Google Authorization Simulation 
app.post('/api/auth/google', (req, res) => {
  const { email, name, googleId } = req.body;
  if (!email || !name) {
    return res.status(400).json({ message: 'Google email and name are required' });
  }

  let user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    // Automatically register Google user!
    const id = 'user_google_' + Math.random().toString(36).substr(2, 9);
    user = {
      id,
      name,
      email,
      phone: '9999999999',
      address: 'Gachibowli, Hyderabad',
      role: UserRole.USER,
      createdAt: new Date().toISOString(),
      passwordHash: bcryptjs.hashSync(Math.random().toString(36), 10),
      isVerified: true
    };
    db.users.push(user);
    saveDatabase();
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  const { passwordHash: _, ...clientUser } = user;
  res.json({ token, user: clientUser, message: 'Google login successful' });
});

// 2. Auth Endpoint: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Both email and password are required' });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isMatch = bcryptjs.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  const { passwordHash: _, ...clientUser } = user;
  res.json({ token, user: clientUser });
});

// 3. Auth Endpoint: Get Profile
app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { passwordHash: _, ...clientUser } = user;
  res.json(clientUser);
});

// 4. Update Profile Address
app.post('/api/user/address', authenticateToken, (req: any, res) => {
  const { address, name, phone } = req.body;

  const userIndex = db.users.findIndex((u) => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (address !== undefined) db.users[userIndex].address = address;
  if (name !== undefined) db.users[userIndex].name = name;
  if (phone !== undefined) db.users[userIndex].phone = phone;

  // Also update delivery personnel list if their role is delivery
  if (db.users[userIndex].role === UserRole.DELIVERY) {
    const dpIndex = db.deliveryPersonnel.findIndex((dp) => dp.id === req.user.id);
    if (dpIndex !== -1) {
      if (name !== undefined) db.deliveryPersonnel[dpIndex].name = name;
      if (phone !== undefined) db.deliveryPersonnel[dpIndex].phone = phone;
    }
  }

  // Update orders placed by user to have the updated profile details if pending
  db.orders.forEach((o) => {
    if (o.userId === req.user.id && o.status === OrderStatus.PENDING) {
      if (address !== undefined) o.userAddress = address;
      if (name !== undefined) o.userName = name;
      if (phone !== undefined) o.userPhone = phone;
    }
  });

  saveDatabase();

  const { passwordHash: _, ...clientUser } = db.users[userIndex];
  res.json({ message: 'Profile updated successfully', user: clientUser });
});

// 5. Get current water can pricing
app.get('/api/pricing', (req, res) => {
  res.json(db.pricing);
});

// 6. Update pricing (Owner Only)
app.post('/api/pricing', authenticateToken, requireRole([UserRole.OWNER]), (req, res) => {
  const { costPerCan } = req.body;
  if (costPerCan === undefined || isNaN(Number(costPerCan)) || Number(costPerCan) <= 0) {
    return res.status(400).json({ message: 'Please supply a valid price amount' });
  }

  db.pricing.costPerCan = Number(costPerCan);
  saveDatabase();

  // Notify clients of updated pricing
  io.emit('pricing_updated', db.pricing);

  res.json({ message: 'Pricing model updated successfully', pricing: db.pricing });
});

// 7. Place New Order (Customer/User Only)
app.post('/api/orders', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const { quantity, customAddress, paymentMethod, deliveryDate, deliveryTimeSlot } = req.body;

  if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
    return res.status(400).json({ message: 'Valid quantity is required' });
  }

  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User profile not found' });
  }

  const addressToUse = customAddress || user.address;
  if (!addressToUse) {
    return res.status(400).json({ message: 'A delivery address must be specified in order or profile' });
  }

  const orderId = 'order_' + Math.floor(100 + Math.random() * 900);
  const price = Number(quantity) * db.pricing.costPerCan;
  const payMethod = (paymentMethod || PaymentMethod.COD) as PaymentMethod;
  const isPaid = false; // Initial order is unpaid until proof verifies or cash collected

  // Default tomorrow date if not provided
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formattedTomorrow = tomorrow.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const newOrder: Order = {
    id: orderId,
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    userAddress: addressToUse,
    quantity: Number(quantity),
    price,
    status: OrderStatus.PENDING_PAYMENT, // Consistent start of workflow
    deliveryId: null,
    deliveryName: null,
    deliveryPhone: null,
    createdAt: new Date().toISOString(),
    paymentMethod: payMethod,
    isPaid: isPaid,
    deliveryDate: deliveryDate || formattedTomorrow,
    deliveryTimeSlot: deliveryTimeSlot || 'Morning: 6:00 AM - 9:00 AM',
  };

  db.orders.push(newOrder);
  saveDatabase();

  // Socket notification to owner/vendors of a new pending order
  io.emit('new_order', newOrder);

  // Send real-time multi-channel alerts (Dashboard feedback + mock SMS + mock WhatsApp)
  notifyUser(
    user.id,
    'Order Placed Successfully',
    `Your order ${orderId} of ${quantity} Cans is confirmed! Status: PENDING_PAYMENT. Scheduled for ${newOrder.deliveryDate} (${newOrder.deliveryTimeSlot}).`,
    `[SMS] AquaFlow: Order ${orderId} confirmed! Slot: ${newOrder.deliveryTimeSlot} on ${newOrder.deliveryDate}.`,
    `[WhatsApp] Hi ${user.name}! Your request for ${quantity} AquaFlow water cans was received! 💧 Scheduled on ${newOrder.deliveryDate} during ${newOrder.deliveryTimeSlot}.`
  );

  // Notify owner
  const owners = db.users.filter(u => u.role === UserRole.OWNER);
  owners.forEach(o => {
    notifyUser(o.id, 'New Order Received', `Order ${orderId} was placed by ${user.name} for ${quantity} cans.`);
  });

  res.status(201).json(newOrder);
});

// 8. Cancel Order (Customer/User (Only before dispatch) or Owner)
app.post('/api/orders/:id/cancel', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const orderIndex = db.orders.findIndex((o) => o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const order = db.orders[orderIndex];

  // Auth restriction: user can only cancel their own order and only if status is PENDING or ACCEPTED (Before assign / dispatch)
  if (req.user.role === UserRole.USER) {
    if (order.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.ACCEPTED) {
      return res.status(400).json({ message: 'Cannot cancel order once it is assigned or out for delivery' });
    }
  }

  order.status = OrderStatus.CANCELLED;

  // Release delivery agent if they were assigned
  if (order.deliveryId) {
    const dpIndex = db.deliveryPersonnel.findIndex((dp) => dp.id === order.deliveryId);
    if (dpIndex !== -1) {
      db.deliveryPersonnel[dpIndex].isAvailable = true;
    }
  }

  saveDatabase();

  // Socket broadcast status update
  io.to(`order_${id}`).emit('status_update', { orderId: id, status: OrderStatus.CANCELLED });
  io.emit('order_list_changed');

  res.json({ message: 'Order cancelled successfully', order });
});

// 9. Get Customer's Orders and Transactions
app.get('/api/orders/my', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const userOrders = db.orders
    .filter((o) => o.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(userOrders);
});

// 10. Get Owner Dashboard Stats & Orders (Owner Only)
app.get('/api/owner/stats', authenticateToken, requireRole([UserRole.OWNER]), (req, res) => {
  const users = db.users.filter((u) => u.role === UserRole.USER);
  const dps = db.deliveryPersonnel;
  const orders = db.orders;

  const totalOrders = orders.length;
  const activeDeliveries = orders.filter(
    (o) => o.status === OrderStatus.ASSIGNED || o.status === OrderStatus.OUT_FOR_DELIVERY
  ).length;
  const revenue = orders
    .filter((o) => o.status === OrderStatus.DELIVERED)
    .reduce((sum, o) => sum + o.price, 0);
  const pendingOrders = orders.filter((o) => o.status === OrderStatus.PENDING).length;

  const stats: SystemStats = {
    totalOrders,
    activeDeliveries,
    revenue,
    pendingOrders,
    customerCount: users.length,
    deliveryPersonnelCount: dps.length,
  };

  res.json(stats);
});

// 11. Find All Orders (Owner Only)
app.get('/api/owner/orders', authenticateToken, requireRole([UserRole.OWNER]), (req, res) => {
  const sortedOrders = [...db.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json(sortedOrders);
});

// 12. Accept Order (Owner Only)
app.post('/api/owner/orders/:id/accept', authenticateToken, requireRole([UserRole.OWNER]), (req, res) => {
  const { id } = req.params;
  const orderIndex = db.orders.findIndex((o) => o.id === id);

  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const allowable = [OrderStatus.PENDING, OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_APPROVED, OrderStatus.PROCESSING];
  if (!allowable.includes(db.orders[orderIndex].status)) {
    return res.status(400).json({ message: `Order cannot be accepted of current state: ${db.orders[orderIndex].status}` });
  }

  db.orders[orderIndex].status = OrderStatus.ACCEPTED;
  saveDatabase();

  io.to(`order_${id}`).emit('status_update', { orderId: id, status: OrderStatus.ACCEPTED });
  io.emit('order_updated', db.orders[orderIndex]);
  io.emit('order_list_changed');

  // Multi-channel notifications
  const reqOrder = db.orders[orderIndex];
  notifyUser(
    reqOrder.userId,
    'Order Accepted by Vendor',
    `Good news! Your order #${id} was accepted by Venkatesh (Vendor Owner) & is being processed.`,
    `[SMS] AquaFlow: Your order #${id} was accepted and is being loaded.`,
    `[WhatsApp] Hello ${reqOrder.userName}! AquaFlow accepted order #${id}. Ready for loading!`
  );

  res.json({ message: 'Order accepted by vendor', order: db.orders[orderIndex] });
});

// 13. Assign Delivery Personnel (Owner Only)
app.post('/api/owner/orders/:id/assign', authenticateToken, requireRole([UserRole.OWNER]), (req, res) => {
  const { id } = req.params;
  const { deliveryPersonnelId } = req.body;

  if (!deliveryPersonnelId) {
    return res.status(400).json({ message: 'Delivery personnel ID is required' });
  }

  const orderIndex = db.orders.findIndex((o) => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const dp = db.deliveryPersonnel.find((d) => d.id === deliveryPersonnelId);
  if (!dp) {
    return res.status(404).json({ message: 'Delivery personnel not found' });
  }

  // Update order
  db.orders[orderIndex].status = OrderStatus.ASSIGNED;
  db.orders[orderIndex].deliveryId = dp.id;
  db.orders[orderIndex].deliveryName = dp.name;
  db.orders[orderIndex].deliveryPhone = dp.phone;
  db.orders[orderIndex].assignedAt = new Date().toISOString();

  // Mark personnel as unavailable
  const dpIndex = db.deliveryPersonnel.findIndex((d) => d.id === deliveryPersonnelId);
  if (dpIndex !== -1) {
    db.deliveryPersonnel[dpIndex].isAvailable = false;
  }

  saveDatabase();

  // Notify via Socket
  io.to(`order_${id}`).emit('status_update', {
    orderId: id,
    status: OrderStatus.ASSIGNED,
    delivery: { name: dp.name, phone: dp.phone },
  });
  io.emit('order_updated', db.orders[orderIndex]);
  io.emit('order_list_changed');
  io.emit(`delivery_assigned_${deliveryPersonnelId}`, db.orders[orderIndex]);

  // Multi-channel notifications
  const reqOrder = db.orders[orderIndex];
  notifyUser(
    reqOrder.userId,
    'Rider Dispatched',
    `Rider ${dp.name} is preparing your dispatch order. Call them at ${dp.phone}.`,
    `[SMS] AquaFlow: Rider ${dp.name} has been assigned order #${id}. Contact: ${dp.phone}`,
    `[WhatsApp] AquaFlow Rider Assigned: Hi ${reqOrder.userName}, ${dp.name} (${dp.phone}) will deliver your fresh cans!`
  );

  res.json({ message: 'Delivery agent assigned successfully', order: db.orders[orderIndex] });
});

// 14. Get list of delivery agents (Owner and Delivery)
app.get('/api/owner/delivery-agents', authenticateToken, (req, res) => {
  res.json(db.deliveryPersonnel);
});

// 15. Create/Register new delivery agent directly (Owner Only)
app.post('/api/owner/delivery-agents', authenticateToken, requireRole([UserRole.OWNER]), (req, res) => {
  const { name, phone, email, password } = req.body;

  if (!name || !phone || !email || !password) {
    return res.status(400).json({ message: 'All registration parameters are required' });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const id = 'user_' + Math.random().toString(36).substr(2, 9);
  const passwordHash = bcryptjs.hashSync(password, 10);

  const newUser = {
    id,
    name,
    email,
    phone,
    address: 'Central Station Depot',
    role: UserRole.DELIVERY,
    createdAt: new Date().toISOString(),
    passwordHash,
  };

  db.users.push(newUser);

  db.deliveryPersonnel.push({
    id,
    name,
    phone,
    currentLatitude: DEPOT_LAT + (Math.random() - 0.5) * 0.01,
    currentLongitude: DEPOT_LON + (Math.random() - 0.5) * 0.01,
    isAvailable: true,
  });

  saveDatabase();
  res.status(201).json({ message: 'Delivery personnel registered', personnel: db.deliveryPersonnel[db.deliveryPersonnel.length - 1] });
});

// 16. Get Agent Assigned Deliveries (Delivery Personnel Only)
app.get('/api/delivery/orders', authenticateToken, requireRole([UserRole.DELIVERY]), (req: any, res) => {
  const orders = db.orders.filter(
    (o) => o.deliveryId === req.user.id && o.status !== OrderStatus.CANCELLED
  );
  res.json(orders);
});

// 17. Accept / Reject Delivery Request (Delivery Personnel Only)
app.post('/api/delivery/orders/:id/respond', authenticateToken, requireRole([UserRole.DELIVERY]), (req: any, res) => {
  const { id } = req.params;
  const { accept } = req.body; // true or false

  const orderIndex = db.orders.findIndex((o) => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const order = db.orders[orderIndex];
  if (order.deliveryId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden. This order is not assigned to you.' });
  }

  if (accept) {
    // Keep standard ASSIGNED status or move to out for delivery based on step
    res.json({ message: 'Delivery assignment accepted.', order });
  } else {
    // Reject: unassign agent and set order status back to ACCEPTED (so owner can reassign)
    order.status = OrderStatus.ACCEPTED;
    order.deliveryId = null;
    order.deliveryName = null;
    order.deliveryPhone = null;

    const dpIndex = db.deliveryPersonnel.findIndex((dp) => dp.id === req.user.id);
    if (dpIndex !== -1) {
      db.deliveryPersonnel[dpIndex].isAvailable = true;
    }

    saveDatabase();

    io.to(`order_${id}`).emit('status_update', { orderId: id, status: OrderStatus.ACCEPTED });
    io.emit('order_list_changed');

    res.json({ message: 'Delivery assignment rejected successfully.', order });
  }
});

// 18. Update Delivery Status (Delivery Personnel Only)
// Transitions: ASSIGNED -> OUT_FOR_DELIVERY -> DELIVERED
app.post('/api/delivery/orders/:id/status', authenticateToken, requireRole([UserRole.DELIVERY]), (req: any, res) => {
  const { id } = req.params;
  const { status, deliveryPhoto, customerSignature } = req.body;

  if (!Object.values(OrderStatus).includes(status)) {
    return res.status(400).json({ message: 'Invalid order status code' });
  }

  const orderIndex = db.orders.findIndex((o) => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const order = db.orders[orderIndex];
  if (order.deliveryId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const nowString = new Date().toISOString();
  order.status = status;

  // Track timestamps and attachments
  if (status === OrderStatus.OUT_FOR_DELIVERY) {
    order.dispatchedAt = nowString;
  }

  if (deliveryPhoto) {
    order.deliveryPhoto = deliveryPhoto;
  }
  if (customerSignature) {
    order.customerSignature = customerSignature;
  }

  // Let's also flip paid status to true when delivered for cash payments (COD)
  if (status === OrderStatus.DELIVERED) {
    order.isPaid = true;
    order.deliveredAt = nowString;
    const dpIndex = db.deliveryPersonnel.findIndex((dp) => dp.id === req.user.id);
    if (dpIndex !== -1) {
      db.deliveryPersonnel[dpIndex].isAvailable = true;
    }
  }

  saveDatabase();

  io.to(`order_${id}`).emit('status_update', { orderId: id, status, deliveryPhoto, customerSignature });
  io.emit('order_updated', order);
  io.emit('order_list_changed');

  // Trigger server-side active location simulation if marked Out for Delivery
  if (status === OrderStatus.OUT_FOR_DELIVERY) {
    startLocationSimulation(id, req.user.id);

    notifyUser(
      order.userId,
      'Order Out For Delivery!',
      `Woohoo! Driver ${order.deliveryName} has loaded your ${order.quantity} cans and is heading your way!`,
      `[SMS] AquaFlow Alert: Order #${id} is out for delivery. Track driver live at: http://localhost:3000/track/${id}`,
      `[WhatsApp] Hello ${order.userName}! 💧 Your ${order.quantity}-can water order #${id} has left our depot. Live track: http://localhost:3000/track/${id}`
    );
  } else if (status === OrderStatus.DELIVERED) {
    notifyUser(
      order.userId,
      'Order Placed successfully & Delivered!',
      `We hope you love our pristine service! Order #${id} was delivered. Please rate the rider!`,
      `[SMS] AquaFlow: Order #${id} has been delivered successfully. Thank you for choosing AquaFlow!`,
      `[WhatsApp] Delivered! 💧 Your water cans were safely delivered. Rate us anytime under ratings!`
    );
  }

  res.json({ message: `Order status updated to ${status}`, order });
});

// 19. Update Agent Coordinate (Manual GPS report from delivery UI)
app.post('/api/delivery/location', authenticateToken, requireRole([UserRole.DELIVERY]), (req: any, res) => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: 'Coordinates latitude and longitude are required' });
  }

  const dpIndex = db.deliveryPersonnel.findIndex((dp) => dp.id === req.user.id);
  if (dpIndex === -1) {
    return res.status(404).json({ message: 'Delivery personnel profile not found' });
  }

  db.deliveryPersonnel[dpIndex].currentLatitude = Number(latitude);
  db.deliveryPersonnel[dpIndex].currentLongitude = Number(longitude);
  saveDatabase();

  // Find active orders for this agent and push coordinates
  const activeOrders = db.orders.filter(
    (o) => o.deliveryId === req.user.id && o.status === OrderStatus.OUT_FOR_DELIVERY
  );

  activeOrders.forEach((o) => {
    io.to(`order_${o.id}`).emit('location_update', {
      orderId: o.id,
      deliveryPersonId: req.user.id,
      latitude: Number(latitude),
      longitude: Number(longitude),
      timestamp: new Date().toISOString(),
    });
  });

  io.emit('agents_location_changed');

  res.json({ message: 'Location updated successfully', location: { latitude, longitude } });
});


/* ================== NOTIFICATION HELPER ================== */
function notifyUser(userId: string, title: string, body: string, smsBody?: string, whatsappBody?: string) {
  const notif = {
    id: 'notif_' + Math.random().toString(36).substr(2, 9),
    title,
    body,
    smsBody: smsBody || `[SMS] AquaFlow: ${title} - ${body}`,
    whatsappBody: whatsappBody || `[WhatsApp] AquaFlow: ${title} - ${body}`,
    createdAt: new Date().toISOString()
  };
  io.emit(`notification_${userId}`, notif);
  io.emit('new_global_notification', { userId, ...notif });
}

/* ================== REVENUE REPORTS & ANALYTICS ================== */
// Super stats including admin aggregates
app.get('/api/admin/reports', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), (req, res) => {
  const users = db.users;
  const orders = db.orders;
  const complaints = db.complaints;
  
  // Group revenue by day
  const dailyRevenue: Record<string, number> = {};
  orders.filter(o => o.status === OrderStatus.DELIVERED).forEach(o => {
    const day = new Date(o.createdAt).toLocaleDateString();
    dailyRevenue[day] = (dailyRevenue[day] || 0) + o.price;
  });

  // Calculate driver performance ranks
  const agentPerformance: Record<string, { name: string; completedCount: number; ratingSum: number; ratingCount: number }> = {};
  orders.filter(o => o.deliveryId).forEach(o => {
    const id = o.deliveryId!;
    if (!agentPerformance[id]) {
      agentPerformance[id] = { name: o.deliveryName || 'Unknown', completedCount: 0, ratingSum: 0, ratingCount: 0 };
    }
    if (o.status === OrderStatus.DELIVERED) {
      agentPerformance[id].completedCount++;
    }
  });

  // Factor in feedback reviews for performance
  db.reviews.forEach(r => {
    const ord = orders.find(o => o.id === r.orderId);
    if (ord && ord.deliveryId) {
      const perf = agentPerformance[ord.deliveryId];
      if (perf) {
        perf.ratingSum += r.rating;
        perf.ratingCount++;
      }
    }
  });

  const performances = Object.entries(agentPerformance).map(([id, p]) => ({
    id,
    name: p.name,
    completed: p.completedCount,
    avgRating: p.ratingCount > 0 ? Number((p.ratingSum / p.ratingCount).toFixed(1)) : 5.0
  }));

  res.json({
    dailyRevenue,
    performances,
    complaintCounts: {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'PENDING').length,
      resolved: complaints.filter(c => c.status === 'RESOLVED').length,
    }
  });
});

/* ================== SUBSCRIPTION SYSTEM ENDPOINTS ================== */
// Get subscriptions (handles USER, OWNER, ADMIN roles)
app.get('/api/subscriptions', authenticateToken, (req: any, res) => {
  if (req.user.role === UserRole.OWNER || req.user.role === UserRole.ADMIN) {
    return res.json(db.subscriptions || []);
  }
  const mySubs = (db.subscriptions || []).filter(s => s.userId === req.user.id);
  res.json(mySubs);
});

// Specific endpoint for owner getting all subscriptions
app.get('/api/subscriptions/all', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), (req, res) => {
  res.json(db.subscriptions || []);
});

// Legacy client-side get subscriptions
app.get('/api/subscriptions/my', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const mySubs = (db.subscriptions || []).filter(s => s.userId === req.user.id);
  res.json(mySubs);
});

// Create subscription handler
const handleCreateSubscription = (req: any, res: any) => {
  const { quantity, frequency, customAddress, address, paymentMethod, selectedDays, nextDeliveryDate } = req.body;

  if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
    return res.status(400).json({ message: 'Valid quantity is required' });
  }
  if (!frequency || !Object.values(SubscriptionFrequency).includes(frequency as any)) {
    return res.status(400).json({ message: 'Valid subscription frequency is required (DAILY, WEEKLY, MONTHLY)' });
  }

  const user = db.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const addressToUse = customAddress || address || user.address;
  if (!addressToUse) {
    return res.status(400).json({ message: 'Address is required to establish delivery cycles' });
  }

  const pricePerCan = db.pricing.costPerCan;
  const totalPrice = Number(quantity) * pricePerCan;
  const payMethod = paymentMethod || PaymentMethod.COD;

  // Compute next delivery date
  const tomorrowStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
  const nextDeliv = nextDeliveryDate || tomorrowStr;

  const initialHistory: any[] = [];
  if (payMethod !== PaymentMethod.COD) {
    initialHistory.push({
      id: 'tx_init_' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toISOString(),
      amount: totalPrice,
      paymentMethod: payMethod as PaymentMethod,
      status: 'PAID'
    });
  }

  const newSub: SubscriptionContract = {
    id: 'sub_' + Math.floor(100 + Math.random() * 900),
    userId: user.id,
    quantity: Number(quantity),
    frequency: frequency as SubscriptionFrequency,
    pricePerCan,
    totalPrice,
    address: addressToUse,
    isActive: true,
    createdAt: new Date().toISOString(),
    paymentMethod: payMethod as PaymentMethod,
    selectedDays: selectedDays || [],
    nextDeliveryDate: nextDeliv,
    paymentHistory: initialHistory
  };

  if (!db.subscriptions) db.subscriptions = [];
  db.subscriptions.push(newSub);
  saveDatabase();

  notifyUser(user.id, 'Subscription Created', `Your recurring ${frequency} subscription of ${quantity} cans is active!`, `[SMS] AquaFlow: Subscribed for ${quantity} cans on ${frequency} plan.`, `[WhatsApp] Yay! ${user.name}, your ${frequency} subscription contract is verified! 💧`);

  res.status(201).json(newSub);
};

app.post('/api/subscriptions', authenticateToken, requireRole([UserRole.USER]), handleCreateSubscription);
app.post('/api/subscriptions/create', authenticateToken, requireRole([UserRole.USER]), handleCreateSubscription);

// Toggle subscription status
app.post('/api/subscriptions/:id/toggle', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const { id } = req.params;
  const subIndex = db.subscriptions.findIndex(s => s.id === id);

  if (subIndex === -1) {
    return res.status(404).json({ message: 'Subscription contract not found' });
  }
  if (db.subscriptions[subIndex].userId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  db.subscriptions[subIndex].isActive = !db.subscriptions[subIndex].isActive;
  saveDatabase();

  notifyUser(
    req.user.id,
    db.subscriptions[subIndex].isActive ? 'Subscription Activated' : 'Subscription Paused',
    `Your subscription contract #${id} has been ${db.subscriptions[subIndex].isActive ? 'activated' : 'paused'}.`,
    `[SMS] AquaFlow: Subscription #${id} was ${db.subscriptions[subIndex].isActive ? 'resumed' : 'paused'}.`,
    `[WhatsApp] Hi! Your AquaFlow subscription #${id} has been ${db.subscriptions[subIndex].isActive ? 'RESUMED' : 'PAUSED'} successfully.`
  );

  res.json(db.subscriptions[subIndex]);
});

// Delete subscription
app.delete('/api/subscriptions/:id', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const { id } = req.params;
  const subIndex = db.subscriptions.findIndex(s => s.id === id);

  if (subIndex === -1) {
    return res.status(404).json({ message: 'Subscription contract not found' });
  }
  if (db.subscriptions[subIndex].userId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  db.subscriptions.splice(subIndex, 1);
  saveDatabase();
  res.json({ message: 'Subscription cancelled and deleted successfully.' });
});

/* ================== EXTRA OWNER SUBSCRIPTION ENDPOINTS ================== */
// Upgrade / Edit Subscription Plan
app.post('/api/subscriptions/:id/upgrade', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const { id } = req.params;
  const { quantity, frequency, selectedDays, paymentMethod, address } = req.body;

  const sub = (db.subscriptions || []).find(s => s.id === id && s.userId === req.user.id);
  if (!sub) {
    return res.status(404).json({ message: 'Active subscription not found' });
  }

  if (quantity) sub.quantity = Number(quantity);
  if (frequency) sub.frequency = frequency;
  if (selectedDays) sub.selectedDays = selectedDays;
  if (paymentMethod) sub.paymentMethod = paymentMethod;
  if (address) sub.address = address;

  sub.pricePerCan = db.pricing.costPerCan;
  sub.totalPrice = sub.quantity * sub.pricePerCan;

  saveDatabase();
  notifyUser(
    sub.userId,
    'Subscription Upgraded',
    `Your plan #${id} is now updated to ${sub.quantity} cans ${sub.frequency.toLowerCase()} (Total ₹${sub.totalPrice}).`,
    `[SMS] AquaFlow: Your subscription plan #${id} successfully upgraded.`,
    `[WhatsApp] AquaFlow Plan Upgrade 💧: Plan #${id} has been modified successfully. New price is ₹${sub.totalPrice}.`
  );

  res.json({ message: 'Subscription successfully upgraded', subscription: sub });
});

/* ================== CUSTOM PAYMENTS & QR CONFIG ENDPOINTS ================== */
// Get payment config
app.get('/api/payment-config', (req, res) => {
  if (!db.paymentConfig) {
    db.paymentConfig = {
      qrCodeUrl: 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=300&auto=format&fit=crop',
      upiId: 'aquaflow@ybl',
      enabledMethods: ['COD', 'G_PAY', 'PHONE_PE', 'PAYTM', 'UPI', 'BANK_TRANSFER'],
      accountDetails: 'AquaFlow Enterprises, HDFC Bank, A/C: 50200012345678, IFSC: HDFC0000123'
    };
  }
  res.json(db.paymentConfig);
});

// Update payment config (Owner/Admin Only)
app.post('/api/payment-config', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), (req, res) => {
  const { qrCodeUrl, upiId, enabledMethods, accountDetails } = req.body;
  
  db.paymentConfig = {
    qrCodeUrl: qrCodeUrl || db.paymentConfig?.qrCodeUrl || 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=300&auto=format&fit=crop',
    upiId: upiId || db.paymentConfig?.upiId || '',
    enabledMethods: enabledMethods || db.paymentConfig?.enabledMethods || [],
    accountDetails: accountDetails || db.paymentConfig?.accountDetails || ''
  };
  saveDatabase();
  io.emit('payment_config_updated', db.paymentConfig);
  res.json({ message: 'Payment configurations updated successfully', config: db.paymentConfig });
});

// Submit Payment Proof for order (User/Customer Only)
app.post('/api/orders/:id/submit-payment', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const { id } = req.params;
  const { screenshot, utrNumber, paymentAmount } = req.body;

  if (!utrNumber) {
    return res.status(400).json({ message: 'UTR / Transaction ID is required' });
  }

  const orderIndex = db.orders.findIndex(o => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const order = db.orders[orderIndex];
  if (order.userId !== req.user.id) {
    return res.status(403).json({ message: 'Unauthorized permission to pay this order' });
  }

  const nowString = new Date().toISOString();

  // Update order fields
  order.status = OrderStatus.PAYMENT_SUBMITTED;
  order.paymentScreenshot = screenshot || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=200&auto=format&fit=crop';
  order.utrNumber = utrNumber;
  order.paymentAmount = paymentAmount ? Number(paymentAmount) : order.price;
  order.paymentSubmittedAt = nowString;

  saveDatabase();

  // Socket notification
  io.emit('order_updated', order);
  io.to(`order_${id}`).emit('status_update', { orderId: id, status: OrderStatus.PAYMENT_SUBMITTED });
  io.emit('order_list_changed');

  // Notifications
  notifyUser(
    order.userId,
    'Payment Submitted',
    `Your payment proof of ₹${order.paymentAmount} (UTR: ${utrNumber}) has been submitted for verification. Order #${id} status is now: PAYMENT_SUBMITTED.`,
    `[SMS] AquaFlow: Payment submitted for Order #${id} with UTR ${utrNumber}. Our vendor is verifying.`,
    `[WhatsApp] Hi ${order.userName}! Payment proof received for water Order #${id}. We'll notify you when approved.💧`
  );

  // Notify Owner
  const owners = db.users.filter(u => u.role === UserRole.OWNER);
  owners.forEach(o => {
    notifyUser(
      o.id,
      'New Payment Proof Uploaded',
      `Customer ${order.userName} has uploaded receipt for Order #${id} with UTR: ${utrNumber}. Verify now!`,
      `[SMS] Vendor Alert: New payment of ₹${order.paymentAmount} uploaded for Order #${id} by ${order.userName}.`,
      `[WhatsApp] Vendor Alert: Order #${id} payment proof is pending approval. UTR: ${utrNumber}. Inspect details in your dashboard.`
    );
  });

  res.json({ message: 'Payment proof submitted successfully', order });
});

// Owner Payment Approval / Resolution
app.post('/api/orders/:id/verify-payment', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), (req, res) => {
  const { id } = req.params;
  const { action, reason } = req.body; // action: 'APPROVE' | 'REJECT' | 'REQUEST_REUPLOAD'

  const orderIndex = db.orders.findIndex(o => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const order = db.orders[orderIndex];
  const nowString = new Date().toISOString();

  if (action === 'APPROVE') {
    order.status = OrderStatus.PAYMENT_APPROVED;
    order.isPaid = true;
    order.paymentApprovedAt = nowString;
    order.paymentRejectedReason = undefined;

    notifyUser(
      order.userId,
      'Payment Approved!',
      `Woohoo! Your payment of ₹${order.paymentAmount || order.price} for Order #${id} has been verified and APPROVED by Owner.`,
      `[SMS] AquaFlow: Payment verified & approved for Order #${id}. Preparing your delivery.`,
      `[WhatsApp] Hello ${order.userName}! 💧 Your water order #${id} payment was approved. We are preparing the dispatches.`
    );
  } else if (action === 'REJECT') {
    order.status = OrderStatus.PENDING_PAYMENT;
    order.paymentRejectedReason = reason || 'Payment verification failed.';
    
    notifyUser(
      order.userId,
      'Payment Verification Failed',
      `Warning: Your payment for Order #${id} was rejected. Reason: ${order.paymentRejectedReason}`,
      `[SMS] AquaFlow: Payment rejected for Order #${id}. Reason: ${order.paymentRejectedReason}`,
      `[WhatsApp] Hi ${order.userName}! There was an issue with payment for Order #${id}: ${order.paymentRejectedReason}`
    );
  } else if (action === 'REQUEST_REUPLOAD') {
    order.status = OrderStatus.PENDING_PAYMENT;
    order.paymentRejectedReason = reason || 'Please re-upload correct payment screenshot and UTR number.';

    notifyUser(
      order.userId,
      'Payment Re-upload Requested',
      `Ref: Order #${id}. Please re-upload your payment receipt screenshot. Reason: ${order.paymentRejectedReason}`,
      `[SMS] AquaFlow Alert: Re-upload payment receipt for Order #${id}. Reason: ${order.paymentRejectedReason}`,
      `[WhatsApp] Hi ${order.userName}! Our billing desk requested a fresh screenshot for Order #${id}. Please login and submit.`
    );
  }

  saveDatabase();
  io.emit('order_updated', order);
  io.to(`order_${id}`).emit('status_update', { orderId: id, status: order.status });
  io.emit('order_list_changed');

  res.json({ message: `Payment handled successfully: ${action}`, order });
});

// Start Processing Order (Owner/Admin Only)
app.post('/api/orders/:id/start-processing', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), (req, res) => {
  const { id } = req.params;
  
  const orderIndex = db.orders.findIndex(o => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const order = db.orders[orderIndex];
  order.status = OrderStatus.PROCESSING;
  
  saveDatabase();
  io.emit('order_updated', order);
  io.to(`order_${id}`).emit('status_update', { orderId: id, status: OrderStatus.PROCESSING });
  io.emit('order_list_changed');

  notifyUser(
    order.userId,
    'Order Under Processing',
    `Your order #${id} has entered the packaging, washing and sterilization cycle!`,
    `[SMS] AquaFlow: Order #${id} in processing line.`,
    `[WhatsApp] Hi ${order.userName}! 💧 Your sterile cans for Order #${id} are being packaged and inspected.`
  );

  res.json({ message: `Order status upgraded to PROCESSING`, order });
});

// Advanced automated scheduler for dispatches (rePLACES dispatch-simulation and covers all criteria)
app.post('/api/subscriptions/dispatch-simulation', authenticateToken, (req: any, resWithCallback) => {
  const activeSubs = (db.subscriptions || []).filter(s => s.isActive);
  const createdOrders: Order[] = [];
  const now = new Date();
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = weekdays[now.getDay()];

  activeSubs.forEach(sub => {
    // Determine if due today
    let isDue = false;
    if (sub.frequency === SubscriptionFrequency.DAILY) {
      isDue = true;
    } else if (sub.frequency === SubscriptionFrequency.WEEKLY) {
      if (!sub.selectedDays || sub.selectedDays.length === 0 || sub.selectedDays.includes(todayName)) {
        isDue = true;
      }
    } else if (sub.frequency === SubscriptionFrequency.MONTHLY) {
      isDue = true;
    }

    if (isDue) {
      const orderId = 'order_sub_' + Math.floor(1000 + Math.random() * 9000);
      const price = sub.quantity * db.pricing.costPerCan;
      const user = db.users.find(u => u.id === sub.userId);
      
      const nextDate = new Date();
      if (sub.frequency === SubscriptionFrequency.DAILY) {
        nextDate.setDate(now.getDate() + 1);
      } else if (sub.frequency === SubscriptionFrequency.WEEKLY) {
        nextDate.setDate(now.getDate() + 7);
      } else if (sub.frequency === SubscriptionFrequency.MONTHLY) {
        nextDate.setMonth(now.getMonth() + 1);
      }
      
      sub.lastDispatchedDate = now.toISOString();
      sub.nextDeliveryDate = nextDate.toISOString().split('T')[0];
      
      if (!sub.paymentHistory) sub.paymentHistory = [];
      const isPrepaid = sub.paymentMethod !== PaymentMethod.COD;
      const txStatus = isPrepaid ? 'PAID' : 'PENDING';
      
      sub.paymentHistory.push({
        id: 'tx_sched_' + Math.floor(100000 + Math.random() * 900000),
        date: now.toISOString(),
        amount: price,
        paymentMethod: sub.paymentMethod,
        status: txStatus as any
      });

      const newOrder: Order = {
        id: orderId,
        userId: sub.userId,
        userName: user?.name || 'Subscribed Client',
        userPhone: user?.phone || '0000000000',
        userAddress: sub.address,
        quantity: sub.quantity,
        price,
        status: isPrepaid ? OrderStatus.PROCESSING : OrderStatus.PENDING_PAYMENT,
        deliveryId: null,
        deliveryName: null,
        deliveryPhone: null,
        createdAt: now.toISOString(),
        paymentMethod: sub.paymentMethod,
        isPaid: isPrepaid,
        subscriptionId: sub.id,
        deliveryDate: now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        deliveryTimeSlot: 'Morning: 6:00 AM - 9:00 AM'
      };

      db.orders.push(newOrder);
      createdOrders.push(newOrder);

      io.emit('new_order', newOrder);
      notifyUser(
        sub.userId,
        'Subscription Automated Order Placed',
        `Your ${sub.frequency.toLowerCase()} subscription auto-placed water order #${orderId} for ${sub.quantity} cans! Method: ${sub.paymentMethod}.`,
        `[SMS] AquaFlow: Sub order #${orderId} generated. Mode: ${sub.paymentMethod}.`,
        `[WhatsApp] Hi ${user?.name || 'Customer'}! 💧 Your automated subscription water order #${orderId} of ${sub.quantity} cans is generated.`
      );
    }
  });

  saveDatabase();
  io.emit('order_list_changed');
  resWithCallback.json({
    message: `Processed scheduler completed! Generated ${createdOrders.length} active subscription orders.`,
    orders: createdOrders
  });
});

/* ================== COMPLAINT MANAGEMENT ENDPOINTS ================== */
// Customer create ticket
app.post('/api/complaints', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const { orderId, subject, message } = req.body;
  if (!orderId || !subject || !message) {
    return res.status(400).json({ message: 'Order ID, subject, and complaint message are required' });
  }

  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'Profile not found' });

  const textId = 'ticket_' + Math.floor(100 + Math.random() * 900);
  const ticket: ComplaintTicket = {
    id: textId,
    orderId,
    userId: user.id,
    customerName: user.name,
    subject,
    message,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  if (!db.complaints) db.complaints = [];
  db.complaints.push(ticket);
  saveDatabase();

  // Socket notification to owner/vendors when complaint raised
  io.emit('new_complaint', ticket);
  
  // Notify owner
  const owners = db.users.filter(u => u.role === UserRole.OWNER);
  owners.forEach(o => {
    notifyUser(o.id, 'New Customer Complaint Raised', `Customer ${user.name} filed complaint on order #${orderId}.`);
  });

  res.status(201).json(ticket);
});

// Get complaints (handles USER, OWNER, ADMIN roles)
app.get('/api/complaints', authenticateToken, (req: any, res) => {
  if (req.user.role === UserRole.OWNER || req.user.role === UserRole.ADMIN) {
    return res.json(db.complaints || []);
  }
  const mine = (db.complaints || []).filter(c => c.userId === req.user.id);
  res.json(mine);
});

// Get all complaints
app.get('/api/complaints/all', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), (req, res) => {
  res.json(db.complaints || []);
});

// Get my complaints legacy (User only)
app.get('/api/complaints/my', authenticateToken, requireRole([UserRole.USER]), (req: any, res) => {
  const mine = (db.complaints || []).filter(c => c.userId === req.user.id);
  res.json(mine);
});

// Get all complaints legacy (Owners and Admins only)
app.get('/api/owner/complaints', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), (req, res) => {
  res.json(db.complaints || []);
});

// Resolve complaint controller function
const handleResolveComplaint = (req: any, res: any) => {
  const { id } = req.params;
  const { responseMessage } = req.body;

  if (!responseMessage) {
    return res.status(400).json({ message: 'A resolution response message is required' });
  }

  const cpIndex = db.complaints.findIndex(c => c.id === id);
  if (cpIndex === -1) {
    return res.status(404).json({ message: 'Complaint ticket not found' });
  }

  db.complaints[cpIndex].status = 'RESOLVED';
  db.complaints[cpIndex].responseMessage = responseMessage;
  saveDatabase();

  notifyUser(
    db.complaints[cpIndex].userId,
    'Complaint Ticket Resolved',
    `Good news! Complaint #${id} was reviewed and resolved: "${responseMessage}"`
  );

  res.json(db.complaints[cpIndex]);
};

app.post('/api/complaints/:id/resolve', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), handleResolveComplaint);
app.post('/api/owner/complaints/:id/resolve', authenticateToken, requireRole([UserRole.OWNER, UserRole.ADMIN]), handleResolveComplaint);

/* ================== REVIEWS & RATINGS SYSTEM ENDPOINTS ================== */
// Get all feedback reviews
const handleGetReviews = (req: any, res: any) => {
  res.json(db.reviews || []);
};
app.get('/api/reviews', authenticateToken, handleGetReviews);
app.get('/api/owner/reviews', authenticateToken, handleGetReviews);

// Submit order review controller function
const handlePostReview = (req: any, res: any) => {
  const id = req.params.id || req.body.orderId;
  const { rating, comments } = req.body;

  if (rating === undefined || isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ message: 'A valid rating between 1 and 5 is required' });
  }

  if (!id) {
    return res.status(400).json({ message: 'Order reference is required' });
  }

  const order = db.orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ message: 'Order details not found' });
  }
  if (order.userId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const existingReview = db.reviews.find(r => r.orderId === id);
  if (existingReview) {
    return res.status(400).json({ message: 'This order has already been rated' });
  }

  const review: OrderReview = {
    id: 'rev_' + Math.floor(100 + Math.random() * 900),
    orderId: id,
    userId: req.user.id,
    customerName: order.userName,
    rating: Number(rating),
    comments: comments || '',
    createdAt: new Date().toISOString()
  };

  if (!db.reviews) db.reviews = [];
  db.reviews.push(review);
  saveDatabase();

  res.status(201).json(review);
};

app.post('/api/orders/:id/review', authenticateToken, requireRole([UserRole.USER]), handlePostReview);
app.post('/api/reviews', authenticateToken, requireRole([UserRole.USER]), handlePostReview);

/* ================== GEMINI AI SUPPORT CHAT ENDPOINT ================== */
app.post('/api/support/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ message: 'Messages array is required' });
  }

  const userMessage = messages[messages.length - 1]?.text || '';

  // Get Gemini SDK client
  const client = getAI();
  if (client) {
    try {
      const systemInstruction = `You are "AquaFlow Support Assistant", a professional human customer service AI for AquaFlow, the premium automated commercial water delivery platform.
AquaFlow serves Hyderabad, providing pristine, mineral-rich 20L water cans on-demand.
We have roles: Customers, Vendor Owners, and Delivery Agents.
Our features: Real-time map route GPS trackers, secure UPI/Razorpay payment portals, flexible subscription cycles (Daily, Weekly, Monthly), and instant notification feeds (Dashboard, SMS, WhatsApp).
Water cans cost $5.00 each.
Be warm, professional, humble, empathetic, and extremely fast with solutions (maximum 3 concise sentences per answer). Call out delivery ETAs and order trackings if asked. Make sure to answer naturally.`;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemInstruction + "\n\nUser: " + userMessage,
      });

      const reply = response.text || "I am currently processing your inquiry. What order can I check for you?";
      return res.json({ reply });
    } catch (err) {
      console.error('Gemini error, falling back to local chat engine:', err);
    }
  }

  // Local fallback engine in case Gemini key is missing or errored
  let reply = "Hello! I am your AquaFlow Assistant. How can I help you today?";
  const text = userMessage.toLowerCase();
  if (text.includes('price') || text.includes('cost') || text.includes('how much')) {
    reply = "AquaFlow offers premium 20-liter mineral water cans at a standard price of $5.00 per can. We also offer subscription discounts!";
  } else if (text.includes('track') || text.includes('where is my')) {
    reply = "To track your order, please click 'Track Delivery' next to your active order in your customer dashboard to watch the delivery agent live on the map!";
  } else if (text.includes('subscribe') || text.includes('subscription')) {
    reply = "You can set up hassle-free recurring subscriptions (Daily, Weekly, or Monthly cycles) under the 'Subscriptions' tab on your customer dashboard! We generate automatically timed order dispatches.";
  } else if (text.includes('complain') || text.includes('delay') || text.includes('rude') || text.includes('late')) {
    reply = "I am so sorry for any inconvenience. You can file a formal support complaint ticket from your active orders list, and our depot managers will resolve it immediately!";
  } else if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
    reply = "Hello! Welcome to AquaFlow Support. I am ready to assist you with order trackings, water subscriptions, or pricing FAQs!";
  } else {
    reply = "Thank you for reaching out to AquaFlow Support. All active order states can be tracked live in real-time, and you can file high-priority tickets under the Support center tab!";
  }

  res.json({ reply });
});

/* ================== GPS PATH SIMULATOR ENGINE (Server-Side) ================== */
const simulations = new Map<string, NodeJS.Timeout>();

function startLocationSimulation(orderId: string, deliveryPersonId: string) {
  // Clear any existing simulation for this order
  if (simulations.has(orderId)) {
    clearInterval(simulations.get(orderId)!);
  }

  // Create a target destination coordinate (slightly offset from DEPOT to simulate route)
  // Let's generate a randomized destination between 2 and 5 km away
  const angle = Math.random() * Math.PI * 2;
  const distance = 0.015 + Math.random() * 0.01; // ~2-3 km
  const destLat = DEPOT_LAT + Math.sin(angle) * distance;
  const destLon = DEPOT_LON + Math.cos(angle) * distance;

  let currentStep = 0;
  const totalSteps = 45; // ~1.5 mins if 2s intervals, let's make it 30 steps of 2s for a quick fun live demo!
  const dpIndex = db.deliveryPersonnel.findIndex((d) => d.id === deliveryPersonId);

  if (dpIndex !== -1) {
    db.deliveryPersonnel[dpIndex].currentLatitude = DEPOT_LAT;
    db.deliveryPersonnel[dpIndex].currentLongitude = DEPOT_LON;
  }

  const interval = setInterval(() => {
    currentStep++;
    const order = db.orders.find((o) => o.id === orderId);

    // If order was cancelled or completed, terminate simulator
    if (!order || order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      clearInterval(interval);
      simulations.delete(orderId);
      return;
    }

    const ratio = currentStep / totalSteps;
    const currentLat = DEPOT_LAT + (destLat - DEPOT_LAT) * ratio;
    const currentLon = DEPOT_LON + (destLon - DEPOT_LON) * ratio;

    const currentDpIndex = db.deliveryPersonnel.findIndex((d) => d.id === deliveryPersonId);
    if (currentDpIndex !== -1) {
      db.deliveryPersonnel[currentDpIndex].currentLatitude = currentLat;
      db.deliveryPersonnel[currentDpIndex].currentLongitude = currentLon;
      saveDatabase();
    }

    const eta = Math.max(1, Math.ceil(15 * (1 - ratio)));

    // Send high priority nearby alert when close!
    if (eta === 2) {
      order.arrivedAt = new Date().toISOString();
      notifyUser(
        order.userId,
        'Rider is Extremely Nearby!',
        `Rider is 2 minutes away! Please keep cash empty or gates open.`,
        `[SMS] AquaFlow alert! Driver has reached your gate entrance.`,
        `[WhatsApp] AquaFlow gate reminder: Rider approaching Flat Flat-402.`
      );
    }

    // Broadcast GPS ping to everyone tracking this order
    io.to(`order_${orderId}`).emit('location_update', {
      orderId,
      deliveryPersonId,
      latitude: currentLat,
      longitude: currentLon,
      timestamp: new Date().toISOString(),
      etaMinutes: eta,
    });

    // Notify agents list of coordinate changes
    io.emit('agents_location_changed');

    // If destiny reached, mark order as ready-to-deliver or drop automatically
    if (currentStep >= totalSteps) {
      clearInterval(interval);
      simulations.delete(orderId);

      // Auto-deliver for nice client-side presentation or let driver press the button
      // To satisfy the "delivery driver completes" loop we let the driver press complete,
      // but we lock the GPS coordinates at the customer destination.
      if (currentDpIndex !== -1) {
        db.deliveryPersonnel[currentDpIndex].currentLatitude = destLat;
        db.deliveryPersonnel[currentDpIndex].currentLongitude = destLon;
        saveDatabase();
      }
    }
  }, 2500); // Pulse every 2.5 seconds

  simulations.set(orderId, interval);
}


/* ================== SOCKET.IO SETUP ================== */
io.on('connection', (socket) => {
  // Join specific order room for tracking
  socket.on('join_order', (orderId) => {
    socket.join(`order_${orderId}`);
  });

  // Leave specific order room
  socket.on('leave_order', (orderId) => {
    socket.leave(`order_${orderId}`);
  });

  // Live driver signal (Manual movement updates)
  socket.on('driver_coordinate', (data) => {
    const { orderId, deliveryPersonId, latitude, longitude, etaMinutes } = data;
    io.to(`order_${orderId}`).emit('location_update', {
      orderId,
      deliveryPersonId,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      etaMinutes,
    });
  });

  socket.on('disconnect', () => {
    // Cleanup
  });
});


// Serve React build using Vite or Express static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`WaterCan Delivery System is listening on http://localhost:${PORT}`);
  });
}

startServer();
