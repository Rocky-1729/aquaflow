/**
 * Shared Type Definitions for AquaFlow Delivery Management System
 */

export enum UserRole {
  USER = 'USER',
  OWNER = 'OWNER',
  DELIVERY = 'DELIVERY',
  ADMIN = 'ADMIN',
}

export enum OrderStatus {
  PENDING = 'PENDING', // legacy/fallback
  ACCEPTED = 'ACCEPTED', // legacy/fallback
  ASSIGNED = 'ASSIGNED', // legacy/fallback
  
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',
  OWNER_VERIFICATION = 'OWNER_VERIFICATION',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PROCESSING = 'PROCESSING',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: UserRole;
  createdAt: string;
  isVerified?: boolean;
}

export enum PaymentMethod {
  COD = 'COD',
  G_PAY = 'G_PAY',
  PHONE_PE = 'PHONE_PE',
  PAYTM = 'PAYTM',
  UPI = 'UPI',
  BANK_TRANSFER = 'BANK_TRANSFER',
  RAZORPAY = 'RAZORPAY',
}

export enum SubscriptionFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export interface SubscriptionContract {
  id: string;
  userId: string;
  quantity: number;
  frequency: SubscriptionFrequency;
  pricePerCan: number;
  totalPrice: number;
  address: string;
  isActive: boolean;
  createdAt: string;
  lastDispatchedDate?: string;
  paymentMethod: PaymentMethod;
  selectedDays?: string[]; // For weekly plans: e.g. ['Monday', 'Wednesday']
  nextDeliveryDate?: string; // Next expected execution date
  paymentHistory?: Array<{
    id: string;
    date: string;
    amount: number;
    paymentMethod: PaymentMethod;
    status: 'PAID' | 'REFUNDED' | 'PENDING';
  }>;
}

export interface ComplaintTicket {
  id: string;
  orderId: string;
  userId: string;
  customerName: string;
  subject: string;
  message: string;
  status: 'PENDING' | 'RESOLVED';
  responseMessage?: string;
  createdAt: string;
}

export interface OrderReview {
  id: string;
  orderId: string;
  userId: string;
  customerName: string;
  rating: number;
  comments: string;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  quantity: number;
  price: number;
  status: OrderStatus;
  deliveryId: string | null;
  deliveryName: string | null;
  deliveryPhone: string | null;
  createdAt: string; // Order placed time
  paymentMethod?: PaymentMethod;
  isPaid?: boolean;
  subscriptionId?: string;
  
  // Delivery Schedule Selection
  deliveryDate?: string; // E.g., "15 June 2026"
  deliveryTimeSlot?: string; // Morning, Afternoon, Evening

  // Payment Verification Proofs
  paymentScreenshot?: string; // Base64/url representation
  utrNumber?: string; // Transaction reference
  paymentAmount?: number;
  paymentRejectedReason?: string;

  // Complete Lifecycle Audit Trail Timestamps
  paymentSubmittedAt?: string;
  paymentApprovedAt?: string;
  assignedAt?: string;
  dispatchedAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;

  // Delivery Proof Assets
  deliveryPhoto?: string; // base64 photo
  customerSignature?: string; // base64 signature doodle
}

export interface DeliveryPersonnel {
  id: string;
  name: string;
  phone: string;
  currentLatitude: number;
  currentLongitude: number;
  isAvailable: boolean;
}

export interface LocationTracking {
  id: string;
  orderId: string;
  deliveryPersonId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface SystemStats {
  totalOrders: number;
  activeDeliveries: number;
  revenue: number;
  pendingOrders: number;
  customerCount: number;
  deliveryPersonnelCount: number;
}

