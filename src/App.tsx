/**
 * WaterCan Delivery Management System - Main App
 * Implements JWT authentication, role-based dashboards, and live GPS tracking
 * with Socket.IO status streams and simulated auto-drive telemetry.
 */

import React, { useState, useEffect, useRef } from 'react';
import { io as socketIO, Socket } from 'socket.io-client';
import {
  Droplets, Trash2, Plus, Minus, Compass, Truck, MapPin, Navigation,
  TrendingUp, User, Users, CheckCircle, Clock, XCircle, 
  Lock, Mail, Phone, Shield, DollarSign, Map, Award, 
  AlertCircle, ExternalLink, Send, Search, FileText, ChevronRight,
  UserPlus, Eye, EyeOff, LayoutDashboard, Settings, History, Info
} from 'lucide-react';
import { UserRole, OrderStatus, User as AppUser, Order, DeliveryPersonnel, SystemStats, PaymentMethod, SubscriptionFrequency } from './types';
import Header from './components/Header';
import LiveRouteMap from './components/LiveRouteMap';
import NotificationToast, { ToastMessage } from './components/NotificationToast';
import { motion, AnimatePresence } from 'motion/react';
import SubscriptionsManager from './components/SubscriptionsManager';
import ComplaintsAndReviews from './components/ComplaintsAndReviews';
import AICustomerSupport from './components/AICustomerSupport';

// Constant coordinates for default Map representations
const DEPOT_LAT = 17.4062;
const DEPOT_LON = 78.4680;

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('watercan_jwt_token'));
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.USER);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Redesign state additions
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // App Common States
  const [pricing, setPricing] = useState({ costPerCan: 5.0 });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);

  // Theme states
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('watercan_theme');
    if (saved) {
      return saved === 'dark';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('watercan_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('watercan_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  // Customer State
  const [quantity, setQuantity] = useState(1);
  const [customDeliveryAddress, setCustomDeliveryAddress] = useState('');
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);

  // Owner State
  const [ownerStats, setOwnerStats] = useState<SystemStats | null>(null);
  const [ownerOrders, setOwnerOrders] = useState<Order[]>([]);
  const [allAgents, setAllAgents] = useState<DeliveryPersonnel[]>([]);
  const [ownerOrdersLoading, setOwnerOrdersLoading] = useState(false);
  const [selectedAgentForOrder, setSelectedAgentForOrder] = useState<{ [orderId: string]: string }>({});
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentSaving, setNewAgentSaving] = useState(false);
  const [newAgentSuccessMessage, setNewAgentSuccessMessage] = useState('');
  const [newPricingRate, setNewPricingRate] = useState<number>(5.0);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [orderQuery, setOrderQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState<string>('ALL');

  // Delivery Agent State
  const [agentOrders, setAgentOrders] = useState<Order[]>([]);
  const [agentOrdersLoading, setAgentOrdersLoading] = useState(false);
  const [isSimulatingAgentGPS, setIsSimulatingAgentGPS] = useState(false);
  const [agentMockLat, setAgentMockLat] = useState<number>(DEPOT_LAT);
  const [agentMockLon, setAgentMockLon] = useState<number>(DEPOT_LON);
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string>('');
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);

  // Quick Order State extensions
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<PaymentMethod>(PaymentMethod.COD);
  const [orderDeliveryDate, setOrderDeliveryDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [orderDeliveryTimeSlot, setOrderDeliveryTimeSlot] = useState<string>('Morning: 6:00 AM - 9:00 AM');

  // Payment Verification & Timeline States
  const [paymentConfig, setPaymentConfig] = useState<{
    qrCodeUrl: string;
    upiId: string;
    enabledMethods: string[];
    accountDetails?: string;
  } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [uploadScreenshot, setUploadScreenshot] = useState('');
  const [uploadUtr, setUploadUtr] = useState('');
  const [uploadAmount, setUploadAmount] = useState<number>(0);
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentVerifyLoading, setPaymentVerifyLoading] = useState(false);

  // Sockets & Refs
  const socketRef = useRef<Socket | null>(null);
  const [gpsUpdateCount, setGpsUpdateCount] = useState(0);

  // Helper: Show Alert Toasts
  const addToast = (title: string, desc: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Date.now().toString();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setToasts((prev) => [{ id, title, desc, type, time }, ...prev].slice(0, 5));
    // Auto-remove Toast after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initial Load & Auth Sync
  useEffect(() => {
    if (token) {
      fetchUserProfile();
    } else {
      // Clear states if logged out
      setCurrentUser(null);
    }
  }, [token]);

  // Fetch Pricing & Payment Configuration
  useEffect(() => {
    fetch('/api/pricing')
      .then((res) => res.json())
      .then((data) => {
        setPricing(data);
        setNewPricingRate(data.costPerCan);
      })
      .catch((err) => console.error('Failed to load current prices', err));

    fetch('/api/payment-config')
      .then((res) => res.json())
      .then((data) => setPaymentConfig(data))
      .catch((err) => console.error('Failed to load payment configuration', err));
  }, []);

  // 2. Fetch User Profile
  const fetchUserProfile = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = await res.json();
        setCurrentUser(profile);
        setCustomDeliveryAddress(profile.address || '');
        addToast('Profile Synchronized', `Welcome back, ${profile.name}! Logged in as ${profile.role}.`, 'success');
      } else {
        // Token stale
        handleLogout();
      }
    } catch (e) {
      console.error('Error synchronizing profile', e);
      handleLogout();
    }
  };

  // 3. Socket.io Event Triggers
  useEffect(() => {
    // Create socket connection
    const origin = window.location.origin;
    const socket = socketIO(origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('connect_error', (err) => {
      // Gracefully log connection error and let socket.io automatically retry or fallback to long-polling
      console.warn('Socket connection error (reverting/retrying):', err.message);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Pricing update broadcast
    socket.on('pricing_updated', (data: any) => {
      setPricing(data);
      addToast('Pricing Updated', `Water can unit rates were set to $${data.costPerCan.toFixed(2)}/can by management.`, 'warning');
    });

    // Notify of new orders
    socket.on('new_order', (newOrder: Order) => {
      addToast('New Order Placed', `Order ${newOrder.id} for ${newOrder.quantity} cans has been received.`, 'info');
      // Refetch if owner
      if (currentUser?.role === UserRole.OWNER) {
        fetchOwnerData();
      }
    });

    // General order updates
    socket.on('order_list_changed', () => {
      if (currentUser?.role === UserRole.OWNER) {
        fetchOwnerData();
      } else if (currentUser?.role === UserRole.DELIVERY) {
        fetchAgentOrders();
      } else if (currentUser?.role === UserRole.USER) {
        fetchMyOrders();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  // Specific Order live status tracking registration
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !trackingOrder) return;

    // Join room for this order
    socket.emit('join_order', trackingOrder.id);

    // Live status alerts callback
    const handleStatusUpdate = (data: { orderId: string; status: OrderStatus; delivery?: any }) => {
      if (data.orderId === trackingOrder.id) {
        setTrackingOrder((prev) => (prev ? { ...prev, status: data.status, ...data.delivery } : prev));
        addToast(
          'Delivery Status Shift',
          `Order ${data.orderId} status is now ${data.status.replace(/_/g, ' ')}.`,
          'info'
        );
        fetchMyOrders();
      }
    };

    // Live GPS telemetry coordinate tracking
    const handleLocationUpdate = (data: {
      orderId: string;
      deliveryPersonId: string;
      latitude: number;
      longitude: number;
      etaMinutes?: number;
    }) => {
      if (data.orderId === trackingOrder.id) {
        setTrackingOrder((prev) =>
          prev
            ? {
                ...prev,
                // We mock store current coordinates inside userAddress path or local map references
                // But we'll feed this coordinates directly to our LiveRouteMap using states
              }
            : prev
        );
        setAgentMockLat(data.latitude);
        setAgentMockLon(data.longitude);
        setGpsUpdateCount((c) => c + 1);
        addToast(
          'Live Route Tracking',
          `Agent moving. Coords: ${data.latitude.toFixed(4)}N, ${data.longitude.toFixed(4)}E. ETA: ${data.etaMinutes || 10} min.`,
          'success'
        );
      }
    };

    socket.on('status_update', handleStatusUpdate);
    socket.on('location_update', handleLocationUpdate);

    return () => {
      socket.emit('leave_order', trackingOrder.id);
      socket.off('status_update', handleStatusUpdate);
      socket.off('location_update', handleLocationUpdate);
    };
  }, [trackingOrder?.id]);

  // Periodic pollers as robust fallbacks
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role === UserRole.USER) {
      fetchMyOrders();
      const interval = setInterval(fetchMyOrders, 8000);
      return () => clearInterval(interval);
    } else if (currentUser.role === UserRole.OWNER) {
      fetchOwnerData();
      const interval = setInterval(fetchOwnerData, 10000);
      return () => clearInterval(interval);
    } else if (currentUser.role === UserRole.DELIVERY) {
      fetchAgentOrders();
      const interval = setInterval(fetchAgentOrders, 8000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // 4. API Core: Customer actions
  const fetchMyOrders = async () => {
    if (customerOrdersLoading) return;
    try {
      const res = await fetch('/api/orders/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data);

        // Auto update tracking order index if there's an active outbound order
        const tracking = data.find(
          (o: Order) =>
            o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED
        );
        if (tracking) {
          setTrackingOrder(tracking);
        } else if (trackingOrder && !data.find((o: Order) => o.id === trackingOrder.id && o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED)) {
          setTrackingOrder(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity,
          customAddress: customDeliveryAddress,
          paymentMethod: orderPaymentMethod,
          deliveryDate: orderDeliveryDate,
          deliveryTimeSlot: orderDeliveryTimeSlot,
        }),
      });

      if (res.ok) {
        const order = await res.json();
        addToast('Order Dispatched', `Placed order ${order.id} containing ${quantity} fresh cans successfully!`, 'success');
        setQuantity(1);
        fetchMyOrders();
      } else {
        const err = await res.json();
        addToast('Order Rejected', err.message || 'Unable to place order', 'warning');
      }
    } catch (e) {
      addToast('Dispatched Failed', 'Internal Connection Error', 'warning');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        addToast('Order Cancelled', `Your order ${orderId} has been successfully closed.`, 'success');
        fetchMyOrders();
        if (trackingOrder?.id === orderId) {
          setTrackingOrder(null);
        }
      } else {
        const err = await res.json();
        addToast('Action Denied', err.message || 'Cannot cancel order', 'warning');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitPaymentProof = async (orderId: string, screenshot: string, utrNumber: string, paymentAmount?: number) => {
    if (!utrNumber) {
      addToast('Validation Error', 'A UTR / Transaction reference ID is strictly required.', 'warning');
      return;
    }
    setPaymentVerifyLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/submit-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ screenshot, utrNumber, paymentAmount }),
      });

      if (res.ok) {
        addToast('Payment Submitted', 'Payment proof submitted successfully! Awaiting owner confirmation.', 'success');
        fetchMyOrders();
        setUploadUtr('');
        setUploadScreenshot('');
        setUploadAmount(0);
      } else {
        const err = await res.json();
        addToast('Submission Refused', err.message || 'Cannot submit payment proof', 'warning');
      }
    } catch (e) {
      console.error(e);
      addToast('Error', 'Connection issue submitting payment receipt.', 'warning');
    } finally {
      setPaymentVerifyLoading(false);
    }
  };

  const handleVerifyPayment = async (orderId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_REUPLOAD', reason?: string) => {
    setPaymentVerifyLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, reason }),
      });

      if (res.ok) {
        addToast('Payment Handled', `Successfully processed code: ${action}`, 'success');
        fetchOwnerData();
        setRejectionReason('');
      } else {
        const err = await res.json();
        addToast('Action Refused', err.message || 'Unable to update payment status', 'warning');
      }
    } catch (e) {
      console.error(e);
      addToast('Error', 'Connection issue updating payment resolution.', 'warning');
    } finally {
      setPaymentVerifyLoading(false);
    }
  };

  const handleStartProcessing = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/start-processing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        addToast('Processing Started', 'Order queue is now marked PROCESSING and loaded for delivery.', 'success');
        fetchOwnerData();
      } else {
        const err = await res.json();
        addToast('Action Refused', err.message || 'Cannot start processing', 'warning');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePaymentConfig = async (qrCodeUrl: string, upiId: string, enabledMethods: string[], accountDetails?: string) => {
    try {
      const res = await fetch('/api/payment-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrCodeUrl, upiId, enabledMethods, accountDetails }),
      });

      if (res.ok) {
        const updated = await res.json();
        setPaymentConfig(updated.config);
        addToast('Config Saved', 'Merchant payment gates modified successfully.', 'success');
      } else {
        const err = await res.json();
        addToast('Action Refused', err.message || 'Cannot save gateway modifications', 'warning');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 5. API Core: Owner actions
  const fetchOwnerData = async () => {
    try {
      const [statsRes, ordersRes, agentsRes] = await Promise.all([
        fetch('/api/owner/stats', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/owner/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/owner/delivery-agents', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (statsRes.ok) setOwnerStats(await statsRes.json());
      if (ordersRes.ok) setOwnerOrders(await ordersRes.json());
      if (agentsRes.ok) setAllAgents(await agentsRes.json());
    } catch (e) {
      console.error('Failed to sync management tables', e);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/owner/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        addToast('Accepted Order', `Order ${orderId} moved to ACCEPTED state. ready for delivery dispatcher!`, 'success');
        fetchOwnerData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignAgent = async (orderId: string) => {
    const agentId = selectedAgentForOrder[orderId];
    if (!agentId) {
      addToast('dispatcher Error', 'Please select an available agent from the drop-down list.', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/owner/orders/${orderId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deliveryPersonnelId: agentId }),
      });

      if (res.ok) {
        const data = await res.json();
        addToast('Job Dispatched', `Rider ${data.order.deliveryName} assigned to route ${orderId}.`, 'success');
        fetchOwnerData();
      } else {
        const err = await res.json();
        addToast('dispatcher Refused', err.message, 'warning');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName || !newAgentPhone || !newAgentEmail || !newAgentPassword) {
      addToast('Validation Failure', 'All agent entry fields are critical and must be filed.', 'warning');
      return;
    }

    setNewAgentSaving(true);
    try {
      const res = await fetch('/api/owner/delivery-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newAgentName,
          phone: newAgentPhone,
          email: newAgentEmail,
          password: newAgentPassword,
        }),
      });

      if (res.ok) {
        addToast('Agent onboarded', `${newAgentName} registered in database!`, 'success');
        setNewAgentName('');
        setNewAgentEmail('');
        setNewAgentPhone('');
        setNewAgentPassword('');
        setNewAgentSuccessMessage(`Successfully registered delivery driver ${newAgentName}! You can now login using their email.`);
        fetchOwnerData();
      } else {
        const err = await res.json();
        addToast('Onboarding Blocked', err.message, 'warning');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNewAgentSaving(false);
    }
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaving(true);
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ costPerCan: newPricingRate }),
      });

      if (res.ok) {
        addToast('Pricing System Reset', `Pricing updated instantly to $${newPricingRate.toFixed(2)} per unit.`, 'success');
        fetchOwnerData();
      } else {
        const err = await res.json();
        addToast('Pricing Error', err.message, 'warning');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPricingSaving(false);
    }
  };

  // 6. API Core: Delivery personnel actions
  const fetchAgentOrders = async () => {
    try {
      const res = await fetch('/api/delivery/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAgentOrders(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptAssignment = async (orderId: string, accept: boolean) => {
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accept }),
      });

      if (res.ok) {
        addToast(
          accept ? 'Mission Accepted' : 'Refused Assignment',
          accept ? 'Please load cans and depart route!' : 'The order was returned to owner queue.',
          accept ? 'success' : 'info'
        );
        fetchAgentOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus, deliveryPhoto?: string, customerSignature?: string) => {
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, deliveryPhoto, customerSignature }),
      });

      if (res.ok) {
        addToast(
          'Status Upgraded',
          `Order is now ${status.replace(/_/g, ' ')}.`,
          'success'
        );
        fetchAgentOrders();

        if (status === OrderStatus.OUT_FOR_DELIVERY) {
          addToast('GPS Active', 'Auto-Drive Satellite Telemetry Simulator Booted on Server.', 'info');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/delivery/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: agentMockLat,
          longitude: agentMockLon,
        }),
      });

      if (res.ok) {
        addToast('Latitude Reported', `Coordinate set to ${agentMockLat}, ${agentMockLon}.`, 'success');
        fetchAgentOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper template simulated ride generator on driver panel
  const handleTriggerMockDriveSimPercentage = (percent: number) => {
    const destLat = DEPOT_LAT + 0.012;
    const destLon = DEPOT_LON + 0.015;
    const computedLat = DEPOT_LAT + (destLat - DEPOT_LAT) * (percent / 100);
    const computedLon = DEPOT_LON + (destLon - DEPOT_LON) * (percent / 100);

    setAgentMockLat(computedLat);
    setAgentMockLon(computedLon);

    // Send coordinates report directly
    fetch('/api/delivery/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ latitude: computedLat, longitude: computedLon }),
    })
      .then((res) => {
        if (res.ok) {
          addToast('Locative Pulse', `Agent simulated drive to ${percent}% of route journey.`, 'success');
        }
      });
  };

  // 7. Profile Updates Saving (Customer/Delivery/Owner common)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setProfileSaving(true);
    try {
      const res = await fetch('/api/user/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: currentUser.name,
          phone: currentUser.phone,
          address: customDeliveryAddress,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        addToast('Database Synced', 'Delivery details locked and updated successfully.', 'success');
      }
    } catch (ee) {
      console.error(ee);
    } finally {
      setProfileSaving(false);
    }
  };

  // 8. Auth Flow Submit: Login or Register
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const apiPath = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const bodyArgs = isRegistering
      ? {
          name: regName,
          email: regEmail,
          password: regPassword,
          phone: regPhone,
          address: regAddress,
          role: regRole,
        }
      : { email: loginEmail, password: loginPassword };

    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyArgs),
      });

      const responseData = await res.json();
      if (res.ok) {
        const fetchedToken = responseData.token;
        const fetchedUser = responseData.user;
        localStorage.setItem('watercan_jwt_token', fetchedToken);
        setToken(fetchedToken);
        setCurrentUser(fetchedUser);

        // Reset variables
        setLoginEmail('');
        setLoginPassword('');
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        setRegPhone('');
        setRegAddress('');
      } else {
        setAuthError(responseData.message || 'Authentication operation failed');
      }
    } catch (err) {
      setAuthError('Connection issues with our central Express API.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('watercan_jwt_token');
    setToken(null);
    setCurrentUser(null);
    setMyOrders([]);
    setAgentOrders([]);
    setOwnerOrders([]);
    setTrackingOrder(null);
    addToast('Logged Out', 'You have been disconnected from secure routes.', 'warning');
  };

  // Preseeded 1-Click quick logs
  const handleQuickLogin = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    setIsRegistering(false);
    addToast('Seeded Profile Loaded', `Ready to verify credentials for ${email}. Click Secure Login below!`, 'info');
  };

  // Owner Table Filters
  const getFilteredOrders = () => {
    return ownerOrders.filter((o) => {
      const matchesSearch =
        o.id.toLowerCase().includes(orderQuery.toLowerCase()) ||
        o.userName.toLowerCase().includes(orderQuery.toLowerCase()) ||
        (o.deliveryName && o.deliveryName.toLowerCase().includes(orderQuery.toLowerCase()));

      const matchesStatus = orderFilter === 'ALL' || o.status === orderFilter;

      return matchesSearch && matchesStatus;
    });
  };

  // Forgot password block
  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      addToast('Input Required', 'Please enter your registered email address.', 'warning');
      return;
    }
    setForgotSuccess(true);
    addToast('Reset Token Sent', `A recovery link has been dispatched to ${forgotEmail}.`, 'success');
    setTimeout(() => {
      setForgotSuccess(false);
      setForgotPasswordMode(false);
      setForgotEmail('');
    }, 3000);
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'customer@watercan.com', password: 'customer123' }),
      });
      const responseData = await res.json();
      if (res.ok) {
        localStorage.setItem('watercan_jwt_token', responseData.token);
        setToken(responseData.token);
        setCurrentUser(responseData.user);
        addToast('Google Sign-In Connected', 'Logged in as Ananya Rao via secure Google session.', 'success');
      } else {
        setAuthError(responseData.message || 'Google verification failed.');
      }
    } catch (e) {
      setAuthError('Google server link timed out.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-850 dark:text-slate-100 font-sans flex flex-col selection:bg-sky-500 selection:text-white transition-colors duration-200" id="main-application-container">
      {/* Dynamic Toast Elements overlay */}
      <NotificationToast toasts={toasts} onRemove={removeToast} />

      {/* Main Header Component */}
      <Header
        currentUser={currentUser}
        socketConnected={socketConnected}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {!currentUser ? (
          /* ======================================================== */
          /* ================= LOGIN & AUTH SCREEN =================== */
          /* ======================================================== */
          <div className="max-w-md mx-auto my-12" id="auth-panel">
            {/* Elegant Brand Welcome Area */}
            <div className="text-center mb-8">
              <div className="inline-flex w-14 h-14 bg-sky-500 rounded-2xl items-center justify-center text-white mb-4 shadow-xl shadow-sky-100 dark:shadow-sky-950/20 ring-4 ring-sky-50/50 dark:ring-sky-900/10">
                <Droplets className="h-7 w-7 animate-pulse" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight font-display text-slate-900 dark:text-white leading-none">
                WaterCan Express
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-xs mx-auto">
                Real-time spatial water delivery dispatch and live spatial tracking.
              </p>
            </div>

            {/* Auth Form Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Form Tabs */}
              <div className="flex bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => { setIsRegistering(false); setForgotPasswordMode(false); setAuthError(''); }}
                  className={`flex-1 py-4 text-center font-bold text-xs uppercase tracking-wider transition-all focus:outline-none ${
                    !isRegistering && !forgotPasswordMode ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-450 border-b-2 border-sky-500' : 'hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  id="auth-toggle-login-btn"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setIsRegistering(true); setForgotPasswordMode(false); setAuthError(''); }}
                  className={`flex-1 py-4 text-center font-bold text-xs uppercase tracking-wider transition-all focus:outline-none ${
                    isRegistering ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-450 border-b-2 border-sky-500' : 'hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  id="auth-toggle-register-btn"
                >
                  Register
                </button>
              </div>

              <div className="p-6 sm:p-8">
                {authError && (
                  <div className="mb-4 bg-red-50 border border-red-150 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs" id="auth-error-msg">
                    <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                    <span className="font-medium">{authError}</span>
                  </div>
                )}

                {forgotPasswordMode ? (
                  /* Forgot Password Form */
                  <form onSubmit={handleForgotSubmit} className="space-y-4" id="forgot-password-form">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Reset password request</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
                        Enter your registered email address and we will immediately dispatch a recovery code to your inbox.
                      </p>
                      
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10 rounded-xl pl-11 pr-4 py-2.5 text-sm transition-all text-slate-850 dark:text-slate-100"
                          placeholder="e.g. customer@watercan.com"
                          required
                          id="forgot-email-input"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={forgotSuccess}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md disabled:bg-emerald-600 disabled:opacity-100"
                    >
                      {forgotSuccess ? 'Code Transmitted!' : 'Send Verification Code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setForgotPasswordMode(false)}
                      className="w-full text-center text-xs text-sky-600 dark:text-sky-400 hover:underline pt-2 inline-block font-semibold"
                    >
                      Return to Sign In
                    </button>
                  </form>
                ) : (
                  /* Standard Login/Register Form */
                  <form onSubmit={handleAuthSubmit} className="space-y-4" id="auth-submit-form">
                    {isRegistering && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">Full Name</label>
                          <input
                            type="text"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-sky-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all text-slate-800 dark:text-slate-100"
                            placeholder="Ananya Rao"
                            required
                            id="reg-input-name"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">Phone</label>
                            <input
                              type="text"
                              value={regPhone}
                              onChange={(e) => setRegPhone(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-sky-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all text-slate-800 dark:text-slate-100"
                              placeholder="7766554433"
                              required
                              id="reg-input-phone"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">Select Role</label>
                            <select
                                value={regRole}
                                onChange={(e) => setRegRole(e.target.value as UserRole)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-sky-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-all text-slate-800 dark:text-slate-100 font-medium"
                                id="reg-input-role"
                              >
                                <option value={UserRole.USER} className="dark:bg-slate-950 text-slate-800 dark:text-slate-100">Customer</option>
                                <option value={UserRole.DELIVERY} className="dark:bg-slate-950 text-slate-800 dark:text-slate-100">Delivery Driver</option>
                                <option value={UserRole.OWNER} className="dark:bg-slate-950 text-slate-800 dark:text-slate-100">Vendor Owner</option>
                              </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">Delivery Address</label>
                          <textarea
                            value={regAddress}
                            onChange={(e) => setRegAddress(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-sky-500 focus:outline-none rounded-xl px-4 py-2 text-sm transition-all text-slate-800 dark:text-slate-100 min-h-[50px] text-xs"
                            placeholder="Flat 101, Serene Gachibowli High-Rise, Hyderabad"
                            id="reg-input-address"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                        <input
                          type="email"
                          value={isRegistering ? regEmail : loginEmail}
                          onChange={(e) => isRegistering ? setRegEmail(e.target.value) : setLoginEmail(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-sky-500 focus:outline-none rounded-xl pl-11 pr-4 py-2.5 text-sm transition-all text-slate-800 dark:text-slate-100"
                          placeholder={isRegistering ? 'email@domain.com' : 'customer@watercan.com'}
                          required
                          id="auth-input-email"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Secret Password</label>
                        {!isRegistering && (
                          <button
                            type="button"
                            onClick={() => setForgotPasswordMode(true)}
                            className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={isRegistering ? regPassword : loginPassword}
                          onChange={(e) => isRegistering ? setRegPassword(e.target.value) : setLoginPassword(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-sky-500 focus:outline-none rounded-xl pl-11 pr-10 py-2.5 text-sm transition-all text-slate-800 dark:text-slate-100"
                          placeholder={isRegistering ? '••••••••' : 'customer123'}
                          required
                          id="auth-input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-45" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full mt-2 py-3 bg-sky-500 text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-sky-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10 disabled:opacity-50"
                      id="auth-submit-btn"
                    >
                      {authLoading ? (
                        <span>Verifying account credentials...</span>
                      ) : isRegistering ? (
                        <>
                          <UserPlus className="h-4 w-4" /> Register New Account
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4" /> Proceed to Secure Sign In
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Google Sign-In with real-simulate toggle */}
                {!forgotPasswordMode && (
                  <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-5">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="w-full py-2.5 border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 active:scale-95 transition-all rounded-xl font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 shadow-sm"
                      id="google-signin-btn"
                    >
                      {/* Brand-colored Google Vector G */}
                      <svg className="h-4 w-4 mr-0.5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      Continue with Google
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Demo Credentials Drawer - beautifully nested at absolute bottom */}
            <div className="mt-8 bg-slate-100 dark:bg-slate-900/50 border border-slate-205 dark:border-slate-800 rounded-xl p-4 shadow-sm text-center">
              <button
                type="button"
                onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-450 hover:text-slate-900 dark:hover:text-slate-205 focus:outline-none transition-colors"
              >
                <Info className="h-3.5 w-3.5 text-sky-500" />
                {showDemoAccounts ? 'Hide Quick Sign-In Credentials' : 'Click here to view Standard Demo Accounts'}
              </button>

              {showDemoAccounts && (
                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 text-left">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium text-center pb-1">
                    Select a seeded test profile below for 1-click credentials fill!
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('customer@watercan.com', 'customer123')}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-sky-50/50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 transition-all text-xs"
                    id="quick-login-customer"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-emerald-600" /> Customer (Ananya Rao)
                    </span>
                    <span className="font-mono text-[9px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">1-Click</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('owner@watercan.com', 'owner123')}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-sky-50/50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 transition-all text-xs"
                    id="quick-login-owner"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-amber-600" /> Vendor Owner (Venkatesh)
                    </span>
                    <span className="font-mono text-[9px] font-bold text-sky-600 dark:text-sky-450 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">1-Click</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickLogin('delivery1@watercan.com', 'delivery123')}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-sky-50/50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 transition-all text-xs"
                    id="quick-login-delivery"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-sky-600" /> Dispatch Rider (Ravi Kumar)
                    </span>
                    <span className="font-mono text-[9px] font-bold text-sky-600 dark:text-sky-450 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">1-Click</span>
                  </button>
                </div>
              )}
            </div>
          </div>
         ) : currentUser.role === UserRole.USER ? (
          /* ======================================================== */
          /* ================= CUSTOMER DASHBOARD ==================== */
          /* ======================================================== */
          <div className="space-y-8 animate-fadeIn" id="customer-portal-wrapper">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-4" id="customer-dashboard">
            
            {/* Customer Portal Left Side Forms */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Profile / Address Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6" id="cust-profile-card">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide font-display">Delivery Address</h3>
                    <p className="text-[10px] text-slate-400 font-mono">PROFILE SETTINGS</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-3.5" id="cust-profile-form">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">Recipient Name</label>
                    <input
                      type="text"
                      value={currentUser.name}
                      onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-800 font-medium"
                      required
                      id="cust-profile-name"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">Contact Phone</label>
                    <input
                      type="text"
                      value={currentUser.phone}
                      onChange={(e) => setCurrentUser({ ...currentUser, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-800 font-medium"
                      required
                      id="cust-profile-phone"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">Home Address</label>
                    <textarea
                      value={customDeliveryAddress}
                      onChange={(e) => setCustomDeliveryAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-slate-800 min-h-[60px]"
                      placeholder="Add flat, street, and landmark details"
                      required
                      id="cust-profile-address"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    id="cust-profile-save-btn"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> 
                    {profileSaving ? 'Saving...' : 'Update Details'}
                  </button>
                </form>
              </div>

              {/* Order Can Quick Dispatch Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6" id="cust-order-dispenser">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Droplets className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide font-display">Quick Order</h3>
                    <p className="text-[10px] text-slate-400 font-mono">DISPATCH WATER CAN</p>
                  </div>
                </div>

                <form onSubmit={handlePlaceOrder} className="space-y-4" id="cust-order-form">
                  <div className="bg-sky-55/40 bg-sky-50 p-4 rounded-xl border border-sky-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-sky-900 font-semibold">Fresh Purified Water Can</p>
                      <p className="text-[10px] text-sky-600 font-mono mt-0.5">Capacity: 20 Liters Standard</p>
                    </div>
                    <span className="text-xs font-extrabold text-sky-700 bg-white/80 px-2 py-1 rounded border border-sky-100 font-mono">
                      ${pricing.costPerCan.toFixed(2)}/can
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                        Delivery Date
                      </label>
                      <input
                        type="date"
                        value={orderDeliveryDate}
                        onChange={(e) => setOrderDeliveryDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                        Time Slot Preferred
                      </label>
                      <select
                        value={orderDeliveryTimeSlot}
                        onChange={(e) => setOrderDeliveryTimeSlot(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-medium"
                      >
                        <option value="Morning: 6:00 AM - 9:00 AM">Morning: 6 to 9 AM</option>
                        <option value="Afternoon: 12:00 PM - 3:00 PM">Afternoon: 12 to 3 PM</option>
                        <option value="Evening: 5:00 PM - 8:00 PM">Evening: 5 to 8 PM</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                        Payment Mode
                      </label>
                      <select
                        value={orderPaymentMethod}
                        onChange={(e) => setOrderPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-indigo-700 dark:text-indigo-400 font-bold"
                      >
                        <option value={PaymentMethod.COD}>COD (Cash on Delivery)</option>
                        <option value={PaymentMethod.G_PAY}>Google Pay / UPI QR</option>
                        <option value={PaymentMethod.PHONE_PE}>PhonePe</option>
                        <option value={PaymentMethod.PAYTM}>Paytm App Wallet</option>
                        <option value={PaymentMethod.UPI}>Direct UPI ID Transfer</option>
                        <option value={PaymentMethod.BANK_TRANSFER}>Net Banking Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                        Delivery Address Override
                      </label>
                      <input
                        type="text"
                        placeholder="Leave empty to use profile address"
                        value={customDeliveryAddress}
                        onChange={(e) => setCustomDeliveryAddress(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Quantity Counter Component */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono text-center">
                      Quantity selection
                    </label>
                    <div className="flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="h-10 w-10 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:bg-slate-200 transition-colors"
                        id="can-qty-decrement"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-lg font-bold font-mono text-slate-900 w-12 text-center" id="can-qty-display">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="h-10 w-10 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:bg-slate-200 transition-colors"
                        id="can-qty-increment"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Pricing Telemetry Metrics */}
                  <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-500 font-sans">Grand Total:</span>
                    <span className="text-base font-extrabold text-slate-900" id="can-pricing-sum">
                      ${(quantity * pricing.costPerCan).toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-sky-500 text-white rounded-xl font-bold text-xs hover:bg-sky-600 active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 shadow shadow-sky-500/10 uppercase tracking-wider"
                    id="place-can-order-btn"
                  >
                    <Send className="h-3.5 w-3.5" /> Place Order
                  </button>
                </form>
              </div>

            </div>

            {/* Customer Tracking Right Panel */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* ACTIVE ORDER REALTIME TELEMETRY TRACKER */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" id="cust-tracking-panel">
                <div className="p-4 sm:p-5 border-b border-slate-150 bg-slate-900 text-white flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-sky-400 rotate-45 animate-pulse" />
                    <div>
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-display">Live Order Tracking</h3>
                      <p className="text-[10px] text-slate-400 font-mono">Driver position updated in real time</p>
                    </div>
                  </div>

                  {trackingOrder ? (
                    <span className="px-2.5 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-mono rounded-full font-bold uppercase animate-pulse">
                      Status: {trackingOrder.status.replace(/_/g, ' ')}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-white/5 text-slate-400 text-[10px] font-mono rounded-full border border-white/10 uppercase">
                      STANDBY
                    </span>
                  )}
                </div>

                <div className="p-5">
                  {trackingOrder ? (
                    <div className="space-y-5">
                      {/* Live Map Layout */}
                      <LiveRouteMap
                        agentLat={agentMockLat}
                        agentLon={agentMockLon}
                        customerAddress={trackingOrder.userAddress}
                        orderStatus={trackingOrder.status}
                      />

                      {/* Timeline Tracker Steps */}
                      <div className="py-2 px-1 border border-slate-100 rounded-xl bg-slate-50/50">
                        <div className="grid grid-cols-4 text-center">
                          {[
                            { code: OrderStatus.PENDING, label: 'Order Placed' },
                            { code: OrderStatus.ACCEPTED, label: 'Accepted' },
                            { code: OrderStatus.ASSIGNED, label: 'Prepared' },
                            { code: OrderStatus.OUT_FOR_DELIVERY, label: 'Out for Delivery' },
                          ].map((step, idx) => {
                            const statuses = [
                              OrderStatus.PENDING,
                              OrderStatus.ACCEPTED,
                              OrderStatus.ASSIGNED,
                              OrderStatus.OUT_FOR_DELIVERY,
                              OrderStatus.DELIVERED,
                            ];
                            const currentIdx = statuses.indexOf(trackingOrder.status as OrderStatus);
                            const i = statuses.indexOf(step.code);
                            const isActive = i <= currentIdx && trackingOrder.status !== OrderStatus.CANCELLED;
                            
                            return (
                              <div key={step.code} className="flex flex-col items-center">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isActive ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-400'
                                }`}>
                                  {idx + 1}
                                </div>
                                <span className={`text-[10px] mt-1 font-semibold ${
                                  isActive ? 'text-slate-800' : 'text-slate-400'
                                }`}>
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Info Panel Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">Order Details</h4>
                          <div className="mt-2.5 space-y-2 text-xs">
                            <p className="flex justify-between">
                              <span className="text-slate-500 font-sans">ID:</span>
                              <span className="font-bold text-slate-900">{trackingOrder.id}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-slate-500 font-sans">Quantity:</span>
                              <span className="font-semibold text-slate-900">{trackingOrder.quantity} Can{trackingOrder.quantity !== 1 ? 's' : ''}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-slate-500 font-sans">Payment Mode:</span>
                              <span className="font-medium text-slate-900">Cash on Delivery</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-slate-500 font-sans">Total Bill:</span>
                              <span className="font-mono text-sky-600 font-bold">${trackingOrder.price.toFixed(2)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                          <div>
                            <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">Delivery Executive</h4>
                            <div className="mt-2 text-xs">
                              {trackingOrder.deliveryId ? (
                                <div className="space-y-1.5 animate-fadeIn">
                                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <Truck className="h-4.5 w-4.5 text-sky-600" /> {trackingOrder.deliveryName || 'Rider Agent'}
                                  </p>
                                  <p className="text-slate-600 flex items-center gap-1.5 text-xs font-mono">
                                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {trackingOrder.deliveryPhone || 'Not Supplied'}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-slate-500 flex items-center gap-1.5 mt-2 font-sans text-xs">
                                  <Clock className="h-4 w-4 animate-spin text-amber-500" /> Preparing your cans for transit...
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-3.5 pt-3.5 border-t border-slate-200 flex gap-2">
                            {/* Cancellation permitted only before assignment outbound */}
                            {(trackingOrder.status === OrderStatus.PENDING ||
                              trackingOrder.status === OrderStatus.ACCEPTED) && (
                              <button
                                onClick={() => handleCancelOrder(trackingOrder.id)}
                                className="w-full py-2 bg-red-50 text-red-650 hover:bg-red-100 active:scale-95 border border-red-200 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                id={`cancel-order-${trackingOrder.id}`}
                              >
                                <XCircle className="h-3.5 w-3.5 text-red-500" /> Cancel Order
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 px-6 text-center text-slate-500 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full border border-slate-250 bg-slate-50 text-slate-400 flex items-center justify-center mb-3">
                        <Compass className="h-6 w-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-m">No Active Deliveries</h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">
                        Place a new water can order using the form on the left, and you can track your delivery live on the map.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Transactions logs table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6" id="cust-orders-history">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                  <FileText className="h-4.5 w-4.5 text-slate-400" />
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest font-mono">Order History</h3>
                </div>

                <div className="overflow-x-auto">
                  {myOrders.length > 0 ? (
                    <table className="w-full text-xs text-left" id="cust-history-table">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                          <th className="py-3 font-semibold">Order ID</th>
                          <th className="py-3 font-semibold">Quantity</th>
                          <th className="py-3 font-semibold">Total Price</th>
                          <th className="py-3 font-semibold">Order Date</th>
                          <th className="py-3 font-semibold">Status</th>
                          <th className="py-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans relative">
                        {myOrders.map((o) => {
                          const isExpanded = expandedOrderId === o.id;
                          return (
                            <React.Fragment key={o.id}>
                                <tr
                                  className="hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100"
                                  onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                                >
                                  <td className="py-3.5 font-bold text-slate-900">{o.id}</td>
                                  <td className="py-3.5 font-semibold text-slate-600">
                                    {o.quantity} Can{o.quantity !== 1 ? 's' : ''}
                                    <div className="text-[10px] text-slate-400 font-normal">
                                      {o.deliveryDate ? `Sched: ${o.deliveryDate}` : 'No date'}
                                      {o.deliveryTimeSlot ? ` (${o.deliveryTimeSlot.split(':')[0]})` : ''}
                                    </div>
                                  </td>
                                  <td className="py-3.5 font-mono text-sky-600 font-extrabold">
                                    ${o.price.toFixed(2)}
                                    <div className="text-[9px] text-slate-400 font-sans font-normal uppercase tracking-wide mt-0.5">
                                      {o.paymentMethod || 'COD'}
                                    </div>
                                  </td>
                                  <td className="py-3.5 text-slate-500 font-mono text-[11px]">{new Date(o.createdAt).toLocaleDateString()}</td>
                                  <td className="py-3.5">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-block ${
                                        o.status === OrderStatus.DELIVERED
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : o.status === OrderStatus.CANCELLED
                                          ? 'bg-red-100 text-red-800'
                                          : o.status === 'PAYMENT_SUBMITTED'
                                          ? 'bg-blue-105 bg-indigo-50 text-indigo-700 animate-pulse border border-indigo-100'
                                          : o.status === 'PENDING_PAYMENT'
                                          ? 'bg-amber-100 text-amber-800'
                                          : o.status === 'PAYMENT_APPROVED'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}
                                    >
                                      {o.status.replace(/_/g, ' ')}
                                    </span>
                                  </td>
                                  <td className="py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedOrderId(isExpanded ? null : o.id);
                                        }}
                                        className="text-[10px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded transition-all"
                                      >
                                        {isExpanded ? 'Hide Details' : 'Details & Pay'}
                                      </button>
                                      {o.id === trackingOrder?.id ? (
                                        <span className="text-[10px] text-sky-500 font-bold animate-pulse">Tracking...</span>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTrackingOrder(o);
                                          }}
                                          className="text-[10px] font-bold text-slate-600 hover:text-sky-600 border border-slate-200 px-2 py-1 rounded"
                                          id={`review-order-${o.id}`}
                                        >
                                          Track Map
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr>
                                    <td colSpan={6} className="bg-slate-50/70 p-4 border-b border-slate-100">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        
                                        {/* Left Side: Chronological Delivery Timeline */}
                                        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm space-y-3 text-left">
                                          <h4 className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 flex items-center gap-1 border-b border-slate-100 pb-2">
                                            <Clock className="h-3.5 w-3.5 text-slate-400" /> Chronological Delivery Timeline
                                          </h4>
                                          
                                          <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4 mt-1.5">
                                            {/* Step 1: Order Placed */}
                                            <div className="relative">
                                              <span className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white"></span>
                                              <p className="text-[11px] font-bold text-slate-900">Order Placed & Registered</p>
                                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                {new Date(o.createdAt).toLocaleString()}
                                              </p>
                                            </div>

                                            {/* Step 2: Payment Submitted */}
                                            {o.paymentMethod !== 'COD' && (
                                              <div className="relative">
                                                <span className={`absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full ${
                                                  o.paymentSubmittedAt ? 'bg-emerald-500' : 'bg-slate-200'
                                                } ring-4 ring-white`}></span>
                                                <p className={`text-[11px] font-bold ${o.paymentSubmittedAt ? 'text-slate-900' : 'text-slate-400'}`}>
                                                  Payment Proof Uploaded
                                                </p>
                                                {o.paymentSubmittedAt ? (
                                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-relaxed">
                                                    UTR: <span className="text-slate-600 font-semibold">{o.utrNumber}</span> <br/>
                                                    Uploaded: {new Date(o.paymentSubmittedAt).toLocaleString()}
                                                  </p>
                                                ) : (
                                                  <p className="text-[10px] text-slate-400">Awaiting user payment upload</p>
                                                )}
                                              </div>
                                            )}

                                            {/* Step 3: Payment Approved */}
                                            {o.paymentMethod !== 'COD' && (
                                              <div className="relative">
                                                <span className={`absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full ${
                                                  o.paymentApprovedAt ? 'bg-emerald-500' : o.paymentRejectedReason ? 'bg-rose-500' : 'bg-slate-200'
                                                } ring-4 ring-white`}></span>
                                                <p className={`text-[11px] font-bold ${
                                                  o.paymentApprovedAt ? 'text-slate-900' : o.paymentRejectedReason ? 'text-rose-650 text-red-650' : 'text-slate-400'
                                                }`}>
                                                  Merchant Verification Status
                                                </p>
                                                {o.paymentApprovedAt ? (
                                                  <p className="text-[10px] text-emerald-600 mt-0.5">
                                                    Approved at {new Date(o.paymentApprovedAt).toLocaleString()}
                                                  </p>
                                                ) : o.paymentRejectedReason ? (
                                                  <p className="text-[10px] text-rose-500 mt-0.5 leading-relaxed">
                                                    Rejection Reason: "{o.paymentRejectedReason}"
                                                  </p>
                                                ) : (
                                                  <p className="text-[10px] text-slate-400">Pending review</p>
                                                )}
                                              </div>
                                            )}

                                            {/* Step 4: Dispatch Assigned */}
                                            <div className="relative">
                                              <span className={`absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full ${
                                                o.assignedAt ? 'bg-emerald-500' : 'bg-slate-200'
                                              } ring-4 ring-white`}></span>
                                              <p className={`text-[11px] font-bold ${o.assignedAt ? 'text-slate-900' : 'text-slate-400'}`}>
                                                Prepared & Rider Assigned
                                              </p>
                                              {o.assignedAt ? (
                                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                  Assigned to {o.deliveryName || 'Rider Personnel'} at {new Date(o.assignedAt).toLocaleString()}
                                                </p>
                                              ) : (
                                                <p className="text-[10px] text-slate-400">Pending driver allocation</p>
                                              )}
                                            </div>

                                            {/* Step 5: Dispatched Out for Delivery */}
                                            <div className="relative">
                                              <span className={`absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full ${
                                                o.dispatchedAt ? 'bg-emerald-500' : 'bg-slate-200'
                                              } ring-4 ring-white`}></span>
                                              <p className={`text-[11px] font-bold ${o.dispatchedAt ? 'text-slate-900' : 'text-slate-400'}`}>
                                                Transit Underway (Out for Delivery)
                                              </p>
                                              {o.dispatchedAt ? (
                                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                  Dispatched at {new Date(o.dispatchedAt).toLocaleString()}
                                                </p>
                                              ) : (
                                                <p className="text-[10px] text-slate-400">Awaiting dispatch</p>
                                              )}
                                            </div>

                                            {/* Step 6: Rider Arrived */}
                                            <div className="relative">
                                              <span className={`absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full ${
                                                o.arrivedAt ? 'bg-emerald-500' : 'bg-slate-200'
                                              } ring-4 ring-white`}></span>
                                              <p className={`text-[11px] font-bold ${o.arrivedAt ? 'text-slate-900' : 'text-slate-400'}`}>
                                                Rider Nearby / Arrived
                                              </p>
                                              {o.arrivedAt ? (
                                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                  Arrived at customer zone at {new Date(o.arrivedAt).toLocaleString()}
                                                </p>
                                              ) : (
                                                <p className="text-[10px] text-slate-400 font-sans">In transit</p>
                                              )}
                                            </div>

                                            {/* Step 7: Completed */}
                                            <div className="relative">
                                              <span className={`absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full ${
                                                o.deliveredAt ? 'bg-emerald-500' : 'bg-slate-200'
                                              } ring-4 ring-white`}></span>
                                              <p className={`text-[11px] font-bold ${o.deliveredAt ? 'text-slate-900' : 'text-slate-400'}`}>
                                                Delivered Successfully
                                              </p>
                                              {o.deliveredAt ? (
                                                <div className="space-y-1.5 mt-1 font-sans text-xs">
                                                  <p className="text-[10px] text-emerald-650 font-mono">
                                                    Delivered: {new Date(o.deliveredAt).toLocaleString()}
                                                  </p>
                                                  {o.customerSignature && (
                                                    <div className="bg-slate-100 p-2 rounded inline-block">
                                                      <span className="text-[9px] text-slate-400 uppercase font-mono block">Signature Verification</span>
                                                      <span className="font-serif italic font-extrabold tracking-wider text-slate-800 text-xs">
                                                        {o.customerSignature}
                                                      </span>
                                                    </div>
                                                  )}
                                                  {o.deliveryPhoto && (
                                                    <div className="mt-1">
                                                      <span className="text-[9px] text-slate-400 uppercase font-mono block mb-0.5">Delivery Proof Photo</span>
                                                      <img
                                                        src={o.deliveryPhoto}
                                                        alt="Proof of Delivery"
                                                        referrerPolicy="no-referrer"
                                                        className="h-16 w-auto rounded border border-slate-200 mt-0.5 shadow-sm"
                                                      />
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <p className="text-[10px] text-slate-400">Awaiting dropoff</p>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Right Side: QR Scan + Verification Form for Pre-paid methods */}
                                        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm space-y-3.5 flex flex-col justify-between text-left">
                                          <div>
                                            <h4 className="text-[10px] font-extrabold uppercase tracking-wider font-mono text-slate-500 border-b border-slate-100 pb-2">
                                              Payment Settlement Status
                                            </h4>
                                            
                                            {o.paymentMethod === 'COD' ? (
                                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-center mt-3">
                                                <p className="text-xs font-bold text-slate-700">💵 Cash on Delivery (COD)</p>
                                                <p className="text-[10px] text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                                                  You can settle the payment directly as cash or scan physical QR code with the driver upon delivery.
                                                </p>
                                              </div>
                                            ) : (
                                              <div className="mt-2.5 space-y-2.5">
                                                
                                                {/* Rejection Notification Indicator */}
                                                {o.paymentRejectedReason && (
                                                  <div className="p-3 bg-rose-50 text-rose-850 rounded-lg border border-rose-100 text-xs balance flex flex-col gap-1">
                                                    <span className="font-extrabold text-rose-700 font-mono flex items-center gap-1">⚠️ Correction Requested:</span>
                                                    <p className="italic text-[11px] text-rose-700 font-sans">
                                                      "{o.paymentRejectedReason}"
                                                    </p>
                                                    <span className="text-[9px] text-slate-500 font-mono">Suggested action: Re-upload receipt screenshot or paste valid UTR.</span>
                                                  </div>
                                                )}

                                                {/* Awaiting Payment Form */}
                                                {(o.status === 'PENDING_PAYMENT' || o.paymentRejectedReason) ? (
                                                  <div className="space-y-3">
                                                    <div className="flex gap-3 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                                                      <img 
                                                        src={paymentConfig?.qrCodeUrl || 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=300&auto=format&fit=crop'} 
                                                        alt="Store Merchant QR Code" 
                                                        referrerPolicy="no-referrer"
                                                        className="w-16 h-16 rounded border border-indigo-200 object-cover shrink-0"
                                                      />
                                                      <div className="text-[11px]">
                                                        <span className="text-[9px] uppercase font-mono font-extrabold text-indigo-700 select-all block">UPI ID: {paymentConfig?.upiId || 'aquaflow@ybl'}</span>
                                                        <p className="text-slate-650 mt-0.5 leading-tight">Settle ${o.price.toFixed(2)} externally on your payment app, then submit UTR proof below.</p>
                                                      </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div>
                                                          <label className="block text-[9px] font-bold text-slate-400 uppercase font-mono mb-0.5">UTR / Txn ID</label>
                                                          <input
                                                            type="text"
                                                            placeholder="12 digit number"
                                                            value={uploadUtr}
                                                            onChange={(e) => setUploadUtr(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                                                          />
                                                        </div>
                                                        <div>
                                                          <label className="block text-[9px] font-bold text-slate-400 uppercase font-mono mb-0.5">Screenshot/Receipt URL</label>
                                                          <input
                                                            type="text"
                                                            placeholder="Screenshot URL"
                                                            value={uploadScreenshot}
                                                            onChange={(e) => setUploadScreenshot(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                                                          />
                                                        </div>
                                                      </div>

                                                      {/* Simulated presets helper */}
                                                      <div>
                                                        <span className="block text-[8px] font-mono text-slate-400 uppercase mb-1">Interactive simulation presets:</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              setUploadUtr('UPI_MOCK_' + Math.floor(Math.random()*900000000000+100000000000));
                                                              setUploadScreenshot('https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=260&auto=format&fit=crop');
                                                            }}
                                                            className="text-[9px] bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium px-2 py-0.5 rounded border border-sky-100 transition-all font-mono"
                                                          >
                                                            ⚡ GPay Preset
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              setUploadUtr('UPI_MOCK_' + Math.floor(Math.random()*900000000000+100000000000));
                                                              setUploadScreenshot('https://images.unsplash.com/photo-1563013544-824ae1d704d3?q=80&w=260&auto=format&fit=crop');
                                                            }}
                                                            className="text-[9px] bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium px-2 py-0.5 rounded border border-purple-100 transition-all font-mono"
                                                          >
                                                            ⚡ PhonePe Preset
                                                          </button>
                                                        </div>
                                                      </div>

                                                      <button
                                                        type="button"
                                                        onClick={() => handleSubmitPaymentProof(o.id, uploadScreenshot || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23', uploadUtr, o.price)}
                                                        disabled={paymentVerifyLoading}
                                                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1 mt-1"
                                                      >
                                                        {paymentVerifyLoading ? 'Submitting proof...' : '📤 Submit Payment Proof'}
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : o.status === 'PAYMENT_SUBMITTED' ? (
                                                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-250 text-center mt-3 space-y-2">
                                                    <p className="text-xs font-bold text-amber-800 animate-pulse">⏰ Verification In Progress</p>
                                                    <p className="text-[10px] text-amber-700 leading-relaxed">
                                                      Reference UTR code: <strong>{o.utrNumber}</strong>.<br/>
                                                      Submitted receipt:
                                                    </p>
                                                    {o.screenshot && (
                                                      <div className="mt-2 text-center">
                                                        <img src={o.screenshot} alt="Submitted receipt" referrerPolicy="no-referrer" className="mx-auto h-20 rounded border mt-1 shadow-sm object-cover" />
                                                      </div>
                                                    )}
                                                    <p className="text-[9px] text-slate-450 mt-1 italic">
                                                      Awaiting review from backoffice store vendor.
                                                    </p>
                                                  </div>
                                                ) : (
                                                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-150 text-center mt-3">
                                                    <p className="text-xs font-bold text-emerald-800">✅ Paid & Fully Approved</p>
                                                    <p className="text-[10px] text-slate-650 mt-1">
                                                      Verified UTR ID: <strong>{o.utrNumber}</strong>
                                                    </p>
                                                    <p className="text-[9px] text-emerald-600 mt-1 font-mono">
                                                      Funds verified. Delivery dispatch approved!
                                                    </p>
                                                  </div>
                                                )}

                                              </div>
                                            )}
                                          </div>
                                          
                                          <div className="pt-2 text-right border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                            <span>Invoice receipt:</span>
                                            <a
                                              href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                                                `=== \nAQUAFLOW COMMERCIAL BILL - TAX INVOICE \n===\n\nOrder ID: ${o.id}\nRegistered On: ${new Date(o.createdAt).toLocaleString()}\nTarget Delivery Date: ${o.deliveryDate || 'Standard Scheduled'}\nDelivery Slot: ${o.deliveryTimeSlot || 'Not Specified'}\nVolume can(s): ${o.quantity} Cans\nItem Type: 20 Liters Purified Water Can\nPackage Rate: $${pricing.costPerCan.toFixed(2)}/can\nInvoice Total: $${o.price.toFixed(2)}\nForm of payment: ${o.paymentMethod || 'COD'}\nAddress of Shipment: ${o.userAddress}\nStatus: ${o.status}\n\nThank you for choosing AquaFlow!\n`
                                              )}`}
                                              download={`Invoice-AquaFlow-${o.id}.abc.txt`}
                                              className="text-sky-600 font-bold hover:underline flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded border border-sky-100"
                                            >
                                              📥 Download Tax Invoice
                                            </a>
                                          </div>
                                        </div>

                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center py-6 text-slate-500 text-xs">No transactions recorded found on this account.</p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Subscriptions Automation Section */}
          <SubscriptionsManager 
            token={token} 
            role="USER" 
            onError={(msg) => addToast('System Error', msg, 'warning')} 
            onSuccess={(msg) => addToast('Ecosystem Sync', msg, 'success')} 
          />

          {/* Disputes Ticket Desk & Client Surveys */}
          <ComplaintsAndReviews 
            token={token} 
            role="USER" 
            orders={myOrders}
            onError={(msg) => addToast('Dispute Center', msg, 'warning')} 
            onSuccess={(msg) => addToast('Dispute Center', msg, 'success')} 
          />

          {/* Gemini AI Powered Instant Support Assist Chat */}
          <AICustomerSupport token={token} userName={currentUser.name} />
        </div>
        ) : currentUser.role === UserRole.OWNER ? (
          /* ======================================================== */
          /* =================== OWNER PORTAL ======================= */
          /* ======================================================== */
          <div className="space-y-6 my-4" id="owner-dashboard">
            
            {/* 6 Key stats dashboard metrics */}
            {ownerStats && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4" id="owner-kpi-boards">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between" id="kpi-orders">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Total Orders</span>
                  <p className="text-2.5xl font-extrabold text-slate-900 font-mono leading-none mt-2">{ownerStats.totalOrders}</p>
                  <p className="text-[9px] text-slate-400 mt-2">All time logs</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between" id="kpi-active">
                  <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest font-mono flex items-center gap-1">In Transit</span>
                  <p className="text-2.5xl font-extrabold text-sky-600 font-mono leading-none mt-2 animate-pulse">{ownerStats.activeDeliveries}</p>
                  <p className="text-[9px] text-sky-500 mt-2 font-semibold">Ready to fulfill</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between" id="kpi-revenue">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-mono">Delivered Rev</span>
                  <p className="text-2.5xl font-extrabold text-emerald-600 font-mono leading-none mt-2">${ownerStats.revenue.toFixed(2)}</p>
                  <p className="text-[9px] text-emerald-400 mt-2 font-semibold">Total Revenue</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between" id="kpi-pending">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest font-mono">Pending</span>
                  <p className="text-2.5xl font-extrabold text-amber-600 font-mono leading-none mt-2">{ownerStats.pendingOrders}</p>
                  <p className="text-[9px] text-amber-400 mt-2">Awaiting Accept</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between" id="kpi-customers">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Customers</span>
                  <p className="text-2.5xl font-extrabold text-slate-900 font-mono leading-none mt-2">{ownerStats.customerCount}</p>
                  <p className="text-[9px] text-slate-400 mt-2">Active Accounts</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between" id="kpi-personnel">
                  <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest font-mono">Agents Count</span>
                  <p className="text-2.5xl font-extrabold text-slate-900 font-mono leading-none mt-2">{ownerStats.deliveryPersonnelCount}</p>
                  <p className="text-[9px] text-sky-500 mt-2 font-semibold">Riders Hub</p>
                </div>
              </div>
            )}

            {/* PENDING DIGITAL PAYMENT VERIFICATIONS WORKFLOW */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="owner-payments-verifier-panel">
              <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 text-left">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                  <p className="text-xs font-extrabold uppercase tracking-wider font-mono text-slate-900">
                    Awaiting Store Payment Verifications
                  </p>
                </div>

                {ownerOrders.filter((o) => o.status === 'PAYMENT_SUBMITTED').length > 0 ? (
                  <div className="space-y-4">
                    {ownerOrders
                      .filter((o) => o.status === 'PAYMENT_SUBMITTED')
                      .map((o) => (
                        <div key={o.id} className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60 grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Receipt Details */}
                          <div className="md:col-span-7 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono font-bold text-slate-500">Order Ref: {o.id}</span>
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded uppercase">Awaiting Settlement</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-950">{o.userName}</h4>
                            <p className="text-xs text-slate-500 font-sans">
                              Preferred delivery: <span className="font-semibold text-slate-700">{o.deliveryDate || 'N/A'} ({o.deliveryTimeSlot || 'N/A'})</span>
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-150 shadow-xs">
                              <div>
                                <span className="text-[9px] text-slate-400 block font-sans">SUBMITTED UTR CODE</span>
                                <span className="font-extrabold text-slate-800 select-all font-mono">{o.utrNumber || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-sans">EXPECTED SETTLEMENT</span>
                                <span className="font-bold text-emerald-700">${o.price.toFixed(2)} ({o.paymentMethod})</span>
                              </div>
                            </div>

                            {/* Action Form */}
                            <div className="space-y-2.5 pt-2">
                              <div>
                                <label className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 mb-1 font-mono">
                                  Action comment / feedback explanation (Required for rejection or re-upload)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Transaction UTR mismatch our banking logs. Please double check draft details."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs"
                                />
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleVerifyPayment(o.id, 'APPROVE')}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded text-xs transition-colors"
                                >
                                  ✅ Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if(!rejectionReason) {
                                      addToast('Input Required', 'Please specify comment reason first.', 'warning');
                                      return;
                                    }
                                    handleVerifyPayment(o.id, 'REJECT', rejectionReason);
                                  }}
                                  className="px-3 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold py-1.5 rounded text-xs border border-rose-200 transition-colors"
                                >
                                  ❌ Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if(!rejectionReason) {
                                      addToast('Input Required', 'Please specify comment reason first.', 'warning');
                                      return;
                                    }
                                    handleVerifyPayment(o.id, 'REQUEST_REUPLOAD', rejectionReason);
                                  }}
                                  className="px-3 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold py-1.5 rounded text-xs border border-amber-200 transition-colors"
                                >
                                  🔄 Ask Re-upload
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Preview screenshot */}
                          <div className="md:col-span-5 bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col items-center justify-center space-y-1 text-center">
                            <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Uploaded Image Proof</span>
                            {o.screenshot ? (
                              <img
                                src={o.screenshot}
                                alt="Proof screenshot"
                                referrerPolicy="no-referrer"
                                className="h-32 w-full object-contain rounded border border-slate-100 shadow-sm mt-1"
                              />
                            ) : (
                              <div className="h-32 w-full bg-slate-50 flex items-center justify-center text-slate-400 text-xs text-center border rounded-lg italic">
                                No screenshot provided
                              </div>
                            )}
                            <a 
                              href={o.screenshot} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[10px] text-sky-650 font-bold hover:underline mt-1 block"
                            >
                              🔍 Open Receipt original tab
                            </a>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 border border-dashed rounded-xl flex flex-col items-center select-none bg-slate-50/30">
                    <p className="text-xs font-bold text-slate-650 text-slate-600">All Digital Transactions Balanced</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                      No customer payment receipts are currently in the verification queue.
                    </p>
                  </div>
                )}
              </div>

              {/* Merchant Gate Gateway configurations */}
              <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3 text-left">
                <p className="text-xs font-extrabold uppercase tracking-wider font-mono text-slate-900 border-b border-slate-100 pb-2.5">
                  Merchant UPI QR Gate Settings
                </p>
                
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">Company Merchant UPI ID</label>
                    <input
                      type="text"
                      id="owner-merchant-upi"
                      className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs rounded font-medium"
                      defaultValue={paymentConfig?.upiId || 'aquaflow@ybl'}
                      placeholder="e.g. flowstore@upi"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">UPI QR Code Asset URL</label>
                    <input
                      type="text"
                      id="owner-merchant-qr"
                      className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs rounded font-mono text-[10px]"
                      defaultValue={paymentConfig?.qrCodeUrl || 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=300&auto=format&fit=crop'}
                      placeholder="Screenshot URL of merchant QR"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-400 font-mono mb-1">Merchant Bank Account Details</label>
                    <textarea
                      id="owner-merchant-bank"
                      className="w-full bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs rounded h-16 resize-none leading-normal font-sans"
                      defaultValue={paymentConfig?.accountDetails || 'AquaFlow Systems, Bank of India, A/C: 987654321012, IFSC: BKID0001234'}
                      placeholder="Net Banking Account Details"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const upi = (document.getElementById('owner-merchant-upi') as HTMLInputElement)?.value;
                      const qr = (document.getElementById('owner-merchant-qr') as HTMLInputElement)?.value;
                      const bank = (document.getElementById('owner-merchant-bank') as HTMLTextAreaElement)?.value;
                      handleSavePaymentConfig(qr, upi, ['COD', 'G_PAY', 'PHONE_PE', 'PAYTM', 'UPI', 'BANK_TRANSFER'], bank);
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    💾 Save QR Gateway Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Middle Section: Active Map Tracker and Dynamic Dispatch Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Active Map Tracking Monitor */}
              <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" id="owner-map-tracker">
                <div className="p-4 border-b border-slate-150 bg-slate-900 text-white flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-amber-400" />
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-100 font-display">Active Deliveries Live Map</h3>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">Real-time GPS tracking of your delivery personnel</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">● All Systems Active</span>
                </div>
                <div className="p-4">
                  <LiveRouteMap
                    agentLat={allAgents[0]?.currentLatitude || DEPOT_LAT}
                    agentLon={allAgents[0]?.currentLongitude || DEPOT_LON}
                    orderStatus="ACTIVE MONITOR"
                  />
                  
                  {/* Active Agents list with fast tracking */}
                  <div className="mt-4 border border-slate-150 rounded-xl p-3 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-3" id="all-active-agent-telemetries">
                    <h4 className="col-span-full text-[10px] font-extrabold font-mono text-slate-500 uppercase tracking-wider mb-1">Riders Status</h4>
                    {allAgents.map((agent) => (
                      <div key={agent.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{agent.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{agent.phone}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${agent.isAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                          {agent.isAvailable ? 'Available' : 'Busy'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* pricing settings and direct team sign up */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* pricing customization Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5" id="owner-pricing-card">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest font-mono border-b border-slate-100 pb-3 mb-4">
                    Water Pricing Settings
                  </h3>

                  <form onSubmit={handleUpdatePrice} className="space-y-4" id="owner-pricing-form">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-155 flex items-center justify-between">
                      <span className="text-xs text-slate-600 font-mono">Current Base Rate:</span>
                      <strong className="text-base font-extrabold text-slate-900 font-mono">
                        ${pricing.costPerCan.toFixed(2)} / Can
                      </strong>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">Update Price per Can</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          type="number"
                          step="0.01"
                          value={newPricingRate}
                          onChange={(e) => setNewPricingRate(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:outline-none rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-medium"
                          required
                          id="pricing-input-cost"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={pricingSaving}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50"
                      id="pricing-save-btn"
                    >
                      {pricingSaving ? 'Saving...' : 'Update Base Price'}
                    </button>
                  </form>
                </div>

                {/* Team Register Panel Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5" id="owner-dp-register">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest font-mono border-b border-slate-100 pb-3 mb-3 flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4 text-sky-500" /> Onboard Delivery Agent
                  </h3>

                  {newAgentSuccessMessage && (
                    <div className="mb-3 bg-emerald-50 border border-emerald-150 text-emerald-800 p-3 rounded-xl text-[11px]" id="agent-success-banner">
                      {newAgentSuccessMessage}
                    </div>
                  )}

                  <form onSubmit={handleCreateAgent} className="space-y-3" id="owner-agent-signup-form">
                    <div>
                      <input
                        type="text"
                        placeholder="Driver Name (e.g., Harish)"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-2 text-xs"
                        required
                        id="new-agent-name"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Contact Phone Line"
                        value={newAgentPhone}
                        onChange={(e) => setNewAgentPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-2 text-xs"
                        required
                        id="new-agent-phone"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={newAgentEmail}
                        onChange={(e) => setNewAgentEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-2 text-xs"
                        required
                        id="new-agent-email"
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        placeholder="Login password"
                        value={newAgentPassword}
                        onChange={(e) => setNewAgentPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-2 text-xs"
                        required
                        id="new-agent-password"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={newAgentSaving}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-wide"
                      id="new-agent-submit"
                    >
                      {newAgentSaving ? 'Onboarding...' : 'Onboard Driver'}
                    </button>
                  </form>
                </div>

              </div>

            </div>

            {/* Bottom Row: Active Dispatch center and Complete Orders Table */}
            <div className="grid grid-cols-1 gap-6">
              
              {/* Dispatch center panel */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5" id="owner-dispatch-panel">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-5 w-5 text-sky-500" />
                    <h3 className="text-xs font-extrabold tracking-widest uppercase font-mono text-slate-900">
                      Order Dispatch and Assignment
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">PENDING ORDERS AWAITING ASSIGNMENT</span>
                </div>

                <div className="overflow-x-auto">
                  {ownerOrders.filter((o) => o.status === OrderStatus.PENDING || o.status === OrderStatus.ACCEPTED || o.status === OrderStatus.ASSIGNED).length > 0 ? (
                    <table className="w-full text-xs text-left" id="owner-dispatch-table">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                          <th className="py-3 font-semibold">Order ID</th>
                          <th className="py-3 font-semibold">Recipient Client</th>
                          <th className="py-3 font-semibold">Home coordinates Address</th>
                          <th className="py-3 font-semibold">Delivery cans</th>
                          <th className="py-3 font-semibold">Status Code</th>
                          <th className="py-3 font-semibold text-center">Dispatch Logistics Router</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans relative">
                        <AnimatePresence mode="popLayout">
                          {ownerOrders
                            .filter((o) => o.status === OrderStatus.PENDING || o.status === OrderStatus.ACCEPTED || o.status === OrderStatus.ASSIGNED)
                            .map((o) => (
                              <motion.tr
                                key={o.id}
                                layout
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="hover:bg-slate-50/40 transition-colors"
                              >
                                <td className="py-3 border-r border-slate-50 pr-2 font-bold text-slate-900">{o.id}</td>
                                <td className="py-3">
                                  <p className="font-semibold text-slate-800">{o.userName}</p>
                                  <p className="text-[10px] font-mono text-zinc-400">{o.userPhone}</p>
                                </td>
                                <td className="py-3 max-w-[200px] truncate text-slate-600 font-medium" title={o.userAddress}>
                                  {o.userAddress}
                                </td>
                                <td className="py-3 font-bold text-slate-700">
                                  {o.quantity} Fresh Cans (${o.price.toFixed(2)})
                                </td>
                                <td className="py-3">
                                  <motion.span
                                    key={`${o.id}-${o.status}`}
                                    layoutId={`dispatch-badge-${o.id}`}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-block ${o.status === OrderStatus.PENDING ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-sky-100 text-sky-800 border border-sky-200'}`}
                                  >
                                    {o.status}
                                  </motion.span>
                                </td>
                                <td className="py-3">
                                  <div className="flex items-center justify-center gap-2">
                                    {o.status === OrderStatus.PENDING ? (
                                      <button
                                        onClick={() => handleAcceptOrder(o.id)}
                                        className="px-3.5 py-1.5 bg-slate-900 text-white rounded font-bold hover:bg-slate-800 transition-colors text-[11px]"
                                        id={`accept-order-vendor-${o.id}`}
                                      >
                                        Accept Order
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded border border-slate-200">
                                        <select
                                          value={selectedAgentForOrder[o.id] || ''}
                                          onChange={(e) =>
                                            setSelectedAgentForOrder({
                                              ...selectedAgentForOrder,
                                              [o.id]: e.target.value,
                                            })
                                          }
                                          className="bg-white border border-slate-300 focus:outline-none px-2 py-1 text-[11px] rounded font-medium"
                                          id={`select-dp-${o.id}`}
                                        >
                                          <option value="">-- Choose Rider --</option>
                                          {allAgents
                                            .filter((dp) => dp.isAvailable)
                                            .map((dp) => (
                                              <option key={dp.id} value={dp.id}>
                                                {dp.name} (Available)
                                              </option>
                                            ))}
                                        </select>
                                        <button
                                          onClick={() => handleAssignAgent(o.id)}
                                          className="px-2.5 py-1 bg-sky-500 text-white rounded font-bold hover:bg-sky-600 transition-colors text-[11px]"
                                          id={`assign-dp-btn-${o.id}`}
                                        >
                                          Assign Route
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center py-6 text-slate-500 font-sans">No pending unassigned dispatches on standby queue.</p>
                  )}
                </div>
              </div>

              {/* Complete logs with filtering */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5" id="owner-all-orders-history">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-3">
                  <h3 className="text-xs font-extrabold tracking-widest uppercase font-mono text-slate-900 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> Global Order Ledger Database
                  </h3>

                  {/* Filters / Search Bar layout */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="relative">
                      <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search courier name/id..."
                        value={orderQuery}
                        onChange={(e) => setOrderQuery(e.target.value)}
                        className="bg-slate-50 border border-slate-200 px-7 py-1.5 focus:outline-none rounded text-xs leading-none"
                        id="owner-history-search"
                      />
                    </div>

                    <select
                      value={orderFilter}
                      onChange={(e) => setOrderFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-2 py-1.5 focus:outline-none rounded text-xs"
                      id="owner-history-filter"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value={OrderStatus.PENDING}>Pending</option>
                      <option value={OrderStatus.ACCEPTED}>Accepted</option>
                      <option value={OrderStatus.ASSIGNED}>Assigned</option>
                      <option value={OrderStatus.OUT_FOR_DELIVERY}>In Transit</option>
                      <option value={OrderStatus.DELIVERED}>Delivered</option>
                      <option value={OrderStatus.CANCELLED}>Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {getFilteredOrders().length > 0 ? (
                    <table className="w-full text-xs text-left" id="owner-history-table">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                          <th className="py-3 font-semibold">ID</th>
                          <th className="py-3 font-semibold">Client Name</th>
                          <th className="py-3 font-semibold">Delivery Point</th>
                          <th className="py-3 font-semibold">Quantity</th>
                          <th className="py-3 font-semibold">Timeline Date</th>
                          <th className="py-3 font-semibold">Agent Assigned</th>
                          <th className="py-3 font-semibold text-right">State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans relative">
                        <AnimatePresence mode="popLayout">
                          {getFilteredOrders().map((o) => (
                            <motion.tr
                              key={o.id}
                              layout
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                              className="hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="py-3.5 font-bold text-slate-950">{o.id}</td>
                              <td className="py-3.5 font-semibold text-slate-800">{o.userName}</td>
                              <td className="py-3.5 text-slate-500 font-medium max-w-[200px] truncate" title={o.userAddress}>
                                {o.userAddress}
                              </td>
                              <td className="py-3.5 font-mono text-slate-700 font-bold">
                                {o.quantity} Cans (${o.price.toFixed(2)})
                              </td>
                              <td className="py-3.5 text-zinc-400 font-mono">
                                {new Date(o.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className="py-3.5 text-slate-600 font-semibold flex items-center gap-1.5 mt-1">
                                {o.deliveryName ? (
                                  <>
                                    <Truck className="h-3.5 w-3.5 text-sky-500" /> {o.deliveryName}
                                  </>
                                ) : (
                                  <span className="text-zinc-400 font-mono">Not Assigned</span>
                                )}
                              </td>
                              <td className="py-3.5 text-right">
                                <motion.span
                                  key={`${o.id}-${o.status}`}
                                  layoutId={`ledger-badge-${o.id}`}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-block ${
                                    o.status === OrderStatus.DELIVERED
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : o.status === OrderStatus.CANCELLED
                                      ? 'bg-red-105 bg-red-105 bg-red-100 text-red-800'
                                      : 'bg-indigo-50 text-indigo-800 border border-indigo-150'
                                  }`}
                                >
                                  {o.status}
                                </motion.span>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center py-6 text-slate-500 text-xs">No orders match the filter queries.</p>
                  )}
                </div>
              </div>

            </div>

             {/* Subscriptions Ledger Tracker (Owner Mode) */}
             <div className="mt-8">
               <SubscriptionsManager 
                 token={token} 
                 role="OWNER" 
                 onError={(msg) => addToast('System Error', msg, 'warning')} 
                 onSuccess={(msg) => addToast('Ecosystem Sync', msg, 'success')} 
               />
             </div>

             {/* Disputes management & Customer surveys tracker */}
             <div className="mt-8">
               <ComplaintsAndReviews 
                 token={token} 
                 role="OWNER" 
                 orders={ownerOrders}
                 onError={(msg) => addToast('Dispute Desk', msg, 'warning')} 
                 onSuccess={(msg) => addToast('Dispute Desk', msg, 'success')} 
               />
             </div>

          </div>
        ) : (
          /* ======================================================== */
          /* ================ DELIVERY RYDER PORTAL ================= */
          /* ======================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-4" id="delivery-dashboard">
            
            {/* Left Side: Drivers current task and Simulator Coordinates */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* CURRENT ACTIVE JOB CONTROLLER CARD */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" id="dp-active-assignment">
                <div className="p-4 bg-slate-900 border-b border-slate-800 text-white flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-sky-400" />
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-100">Route Tracking & Simulator</h3>
                      <p className="text-[9px] text-slate-400 font-mono">Step-by-step route guidance</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-sky-500/10 border border-sky-500/30 text-sky-400 font-mono px-2 py-0.5 rounded uppercase">
                    Active Shift
                  </span>
                </div>

                <div className="p-5">
                  {agentOrders.filter((o) => o.status !== OrderStatus.DELIVERED).length > 0 ? (
                    (() => {
                      const activeJob = agentOrders.find((o) => o.status !== OrderStatus.DELIVERED)!;
                      return (
                        <div className="space-y-5">
                          {/* Segment Header */}
                          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                            <div>
                               <h4 className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-wider">Delivery Destination</h4>
                              <h2 className="text-lg font-extrabold text-slate-950 mt-1">{activeJob.userName}</h2>
                              <p className="text-xs text-slate-650 flex items-center gap-1 mt-1">
                                <MapPin className="h-4 w-4 text-emerald-600 shrink-0" /> {activeJob.userAddress}
                              </p>
                            </div>

                            <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold font-mono border border-amber-200">
                              {activeJob.status}
                            </span>
                          </div>

                          {/* Map showing current simulator location */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <LiveRouteMap
                              agentLat={agentMockLat}
                              agentLon={agentMockLon}
                              customerAddress={activeJob.userAddress}
                              orderStatus={activeJob.status}
                            />
                          </div>

                          {/* Action Log Controls */}
                          <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 space-y-4 shadow-sm">
                            <div>
                              <h4 className="text-[10px] font-extrabold font-mono text-sky-900 uppercase tracking-widest flex items-center gap-1 mb-2">
                                <Compass className="h-4 w-4 text-sky-600" /> Route Simulation Panel
                              </h4>
                              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                                Update your delivery progress by simulating movement on the route. This updates the live map for both the customer and the store owner instantly.
                              </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <button
                                onClick={() => handleTriggerMockDriveSimPercentage(0)}
                                className="py-2 px-1 text-center bg-white border border-slate-200 rounded-xl text-[11px] font-mono hover:bg-slate-50 transition-colors font-semibold"
                              >
                                At Store (0%)
                              </button>
                              <button
                                onClick={() => handleTriggerMockDriveSimPercentage(33)}
                                className="py-2 px-1 text-center bg-white border border-slate-200 rounded-xl text-[11px] font-mono hover:bg-slate-50 transition-colors font-semibold"
                              >
                                On the Way (33%)
                              </button>
                              <button
                                onClick={() => handleTriggerMockDriveSimPercentage(66)}
                                className="py-2 px-1 text-center bg-white border border-slate-200 rounded-xl text-[11px] font-mono hover:bg-slate-50 transition-colors font-semibold"
                              >
                                Nearby (66%)
                              </button>
                              <button
                                onClick={() => handleTriggerMockDriveSimPercentage(100)}
                                className="py-2 px-1 text-center bg-white border border-slate-200 rounded-xl text-[11px] font-mono hover:bg-slate-50 transition-colors font-semibold"
                              >
                                Arrived (100%)
                              </button>
                            </div>

                            {/* State transitions */}
                            <div className="flex gap-3 pt-2">
                              {activeJob.status === OrderStatus.ASSIGNED && (
                                <button
                                  onClick={() => handleUpdateStatus(activeJob.id, OrderStatus.OUT_FOR_DELIVERY)}
                                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs active:scale-95 transition-all text-center"
                                  id={`depart-depot-btn-${activeJob.id}`}
                                >
                                  Start Delivery (Out for Delivery)
                                </button>
                              )}

                              {activeJob.status === OrderStatus.OUT_FOR_DELIVERY && (
                                <div className="space-y-4 border-t border-slate-150 pt-3 text-left w-full">
                                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">
                                    Delivery Handshake & Proof Checklist
                                  </h4>
                                  
                                  {/* Photo selection presets */}
                                  <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                                      1. Take / Choose Delivery Spot Photo Proof
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {[
                                        { label: '🚪 Front Door Drop', url: 'https://images.unsplash.com/photo-1585830812416-a6c86bb14576?q=80&w=300&auto=format&fit=crop' },
                                        { label: '🏢 Reception Desk', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=300&auto=format&fit=crop' },
                                        { label: '👨 Client Hands', url: 'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?q=80&w=300&auto=format&fit=crop' },
                                        { label: '📦 Security Guard', url: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?q=80&w=300&auto=format&fit=crop' }
                                      ].map((preset) => (
                                        <button
                                          key={preset.label}
                                          type="button"
                                          onClick={() => setProofPhotoUrl(preset.url)}
                                          className={`py-2 px-1 text-center rounded-lg border text-[11px] font-medium transition-all ${proofPhotoUrl === preset.url ? 'bg-sky-50 border-sky-500 text-sky-700 font-bold scale-98 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                        >
                                          {preset.label}
                                        </button>
                                      ))}
                                    </div>

                                    {/* Custom Photo URL Input */}
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="Or paste custom delivery verification image URL..."
                                        value={proofPhotoUrl}
                                        onChange={(e) => setProofPhotoUrl(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-[11px]"
                                      />
                                    </div>
                                    {proofPhotoUrl && (
                                      <div className="mt-1 flex items-center gap-2">
                                        <img src={proofPhotoUrl} alt="Selected Proof" referrerPolicy="no-referrer" className="h-10 w-16 object-cover rounded border" />
                                        <span className="text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-1">✅ Photo Proof Staged</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Signature Pad */}
                                  <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                                      2. Digital Customer Handshake Signature
                                    </label>
                                    
                                    <div className="relative border border-slate-200 bg-slate-50 rounded-xl overflow-hidden p-3 shadow-xs">
                                      <p className="text-[10px] text-slate-400 mb-2 italic">Drag with mouse cursor or swipe on mobile screen to draw client signature below:</p>
                                      
                                      {/* Canvas code */}
                                      <div className="h-24 w-full bg-white border border-slate-200 relative rounded-lg overflow-hidden touch-none" id="signature-pad-container">
                                        <canvas
                                          id="delivery-signature-canvas"
                                          width="400"
                                          height="96"
                                          className="absolute inset-0 h-full w-full cursor-crosshair bg-white"
                                          onMouseDown={(e) => {
                                            const canvas = e.currentTarget;
                                            const rect = canvas.getBoundingClientRect();
                                            const ctx = canvas.getContext('2d');
                                            if (ctx) {
                                              ctx.beginPath();
                                              ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                                              ctx.lineWidth = 2.5;
                                              ctx.strokeStyle = '#0f172a'; // slate-900
                                              setIsDrawingSig(true);
                                            }
                                          }}
                                          onMouseMove={(e) => {
                                            if (!isDrawingSig) return;
                                            const canvas = e.currentTarget;
                                            const rect = canvas.getBoundingClientRect();
                                            const ctx = canvas.getContext('2d');
                                            if (ctx) {
                                              ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                                              ctx.stroke();
                                            }
                                          }}
                                          onMouseUp={() => setIsDrawingSig(false)}
                                          onMouseLeave={() => setIsDrawingSig(false)}
                                          
                                          onTouchStart={(e) => {
                                            const canvas = e.currentTarget;
                                            const rect = canvas.getBoundingClientRect();
                                            const ctx = canvas.getContext('2d');
                                            if (ctx && e.touches[0]) {
                                              ctx.beginPath();
                                              ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                                              ctx.lineWidth = 2.5;
                                              ctx.strokeStyle = '#0f172a';
                                              setIsDrawingSig(true);
                                            }
                                          }}
                                          onTouchMove={(e) => {
                                            if (!isDrawingSig) return;
                                            const canvas = e.currentTarget;
                                            const rect = canvas.getBoundingClientRect();
                                            const ctx = canvas.getContext('2d');
                                            if (ctx && e.touches[0]) {
                                              ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                                              ctx.stroke();
                                            }
                                          }}
                                          onTouchEnd={() => setIsDrawingSig(false)}
                                        />
                                      </div>

                                      <div className="flex justify-between items-center mt-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const canvas = document.getElementById('delivery-signature-canvas') as HTMLCanvasElement;
                                            if (canvas) {
                                              const ctx = canvas.getContext('2d');
                                              if (ctx) {
                                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                              }
                                            }
                                          }}
                                          className="px-2 py-0.5 text-[9px] uppercase font-mono font-bold bg-white border hover:bg-slate-50 text-slate-500 rounded"
                                        >
                                          Clear Pad
                                        </button>
                                        <span className="text-[9px] text-slate-400 font-mono">Digitally Verified</span>
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => {
                                      let signatureDataUrlStr = '';
                                      const canvas = document.getElementById('delivery-signature-canvas') as HTMLCanvasElement;
                                      if (canvas) {
                                        signatureDataUrlStr = canvas.toDataURL('image/png');
                                      }
                                      handleUpdateStatus(activeJob.id, OrderStatus.DELIVERED, proofPhotoUrl, signatureDataUrlStr);
                                    }}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 shadow shadow-emerald-500/10"
                                    id={`complete-delivery-btn-${activeJob.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4" /> Drop Can & Mark Delivered
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                      <div className="p-3 bg-slate-105 h-12 w-12 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50 text-slate-400 mb-3">
                        <Truck className="h-6 w-6" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">No Active Assignment</h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">
                        Go to the Assigned Jobs inbox below to accept assigned dispatches from the vendor owner.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ASSIGNED JOBS INBOX TABLE */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5" id="dp-jobs-inbox">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4">
                  <FileText className="h-4.5 w-4.5 text-slate-400" />
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest font-mono">Assigned Jobs Inbox</h3>
                </div>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {agentOrders.length > 0 ? (
                      agentOrders.map((o) => (
                        <motion.div
                          key={o.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95, y: 12 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-800">{o.id}</span>
                              <motion.span
                                key={`${o.id}-${o.status}`}
                                layoutId={`agent-badge-${o.id}`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                className="text-[10px] px-1.5 py-0.2 ml-1 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded font-bold font-mono inline-block"
                              >
                                {o.status}
                              </motion.span>
                            </div>
                            <p className="font-bold text-slate-950 text-sm leading-tight">{o.userName}</p>
                            <p className="text-xs text-slate-600 flex items-center gap-1 font-sans">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /> {o.userAddress}
                            </p>
                            <p className="text-[11px] text-sky-600 font-bold font-mono mt-0.5">
                              {o.quantity} fresh cans on delivery • ${o.price.toFixed(2)}
                            </p>
                          </div>

                          {o.status === OrderStatus.ASSIGNED ? (
                            <div className="flex gap-2 sm:self-center">
                              <button
                                onClick={() => handleAcceptAssignment(o.id, false)}
                                className="px-4 py-2 hover:bg-red-50 text-red-650 border border-red-200 text-xs font-bold rounded-lg transition-colors bg-white text-red-600"
                                id={`reject-job-${o.id}`}
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleAcceptAssignment(o.id, true)}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow"
                                id={`accept-job-${o.id}`}
                              >
                                Accept Job
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-mono font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg border-emerald-200">
                              <CheckCircle className="h-3.5 w-3.5" /> Job Under-Way
                            </span>
                          )}
                        </motion.div>
                      ))
                    ) : (
                      <p className="text-center py-6 text-slate-500 text-xs font-mono">Your assigned inbox is empty right now.</p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </div>

            {/* Right Side: Manual GPS coordinates tester */}
            <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5" id="dp-manual-gps">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest font-mono border-b border-slate-100 pb-3 mb-4">
                  Manual GPS Reporter
                </h3>

                <form onSubmit={handleManualLocationSubmit} className="space-y-4" id="dp-manual-coords-form">
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    Simulate your real-time GPS reports by updating the latitude and longitude parameters manually. This updates customer and vendor screens instantly through the websocket.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={agentMockLat}
                        onChange={(e) => setAgentMockLat(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
                        id="dp-mock-lat-input"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={agentMockLon}
                        onChange={(e) => setAgentMockLon(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
                        id="dp-mock-lon-input"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all"
                    id="dp-mock-report-submit"
                  >
                    Transmit Coordinates
                  </button>
                </form>
              </div>

              {/* Delivery Driver Statistics */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5" id="dp-stats-summary">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest font-mono border-b border-slate-100 pb-3 mb-4">
                  Shift Metrics
                </h3>

                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Shift status:</span>
                    <span className="font-mono font-bold text-emerald-600 uppercase">On Duty</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Delivered Total Today:</span>
                    <span className="font-mono font-bold text-slate-850">
                      {agentOrders.filter((o) => o.status === OrderStatus.DELIVERED).length} Cans
                    </span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-slate-500">Active Pipeline Routes:</span>
                    <span className="font-mono font-bold text-slate-855 text-sky-600">
                      {agentOrders.filter((o) => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED).length} Jobs
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      <footer className="w-full mt-auto py-6 border-t border-slate-100 dark:border-slate-900 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm text-center text-xs text-slate-400 dark:text-slate-500 font-sans transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p>© 2026 WaterCan Delivery Management System. All rights reserved.</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider font-mono flex items-center justify-center gap-1.5">
            System Network Connection: {socketConnected ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">● Online</span>
            ) : (
              <span className="text-amber-500 dark:text-amber-400 font-bold">● Active (Polling)</span>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
