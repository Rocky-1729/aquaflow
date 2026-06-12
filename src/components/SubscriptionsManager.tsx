import React, { useState, useEffect } from 'react';
import { 
  Calendar, Trash2, CheckCircle, XCircle, Plus, DollarSign, ToggleLeft, ToggleRight, 
  Sparkles, AlertCircle, Edit, Save, History, TrendingUp, Users, HeartPulse, RefreshCw
} from 'lucide-react';
import { SubscriptionContract, SubscriptionFrequency, PaymentMethod } from '../types';

interface SubscriptionsManagerProps {
  token: string | null;
  role: 'USER' | 'OWNER' | 'DELIVERY' | 'ADMIN';
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SubscriptionsManager({ token, role, onError, onSuccess }: SubscriptionsManagerProps) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionContract[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(SubscriptionFrequency.DAILY);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.COD);
  const [customAddress, setCustomAddress] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  // Editing state for Upgrades
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editFreq, setEditFreq] = useState<SubscriptionFrequency>(SubscriptionFrequency.DAILY);
  const [editPayMethod, setEditPayMethod] = useState<PaymentMethod>(PaymentMethod.COD);
  const [editAddress, setEditAddress] = useState('');
  const [editDays, setEditDays] = useState<string[]>([]);

  // Expanded History view
  const [expandedHistSubId, setExpandedHistSubId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, [token, role]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const endpoint = (role === 'OWNER' || role === 'ADMIN') ? '/api/subscriptions/all' : '/api/subscriptions';
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (e) {
      console.error('Failed to fetch subscriptions', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (frequency === SubscriptionFrequency.WEEKLY && selectedDays.length === 0) {
      onError('Please select at least one day of the week for weekly subscriptions.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity,
          frequency,
          paymentMethod,
          customAddress,
          selectedDays: frequency === SubscriptionFrequency.WEEKLY ? selectedDays : [],
          nextDeliveryDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
        }),
      });

      if (res.ok) {
        onSuccess(`Subscribed successfully! Custom deliveries scheduled ${frequency.toLowerCase()}.`);
        setQuantity(1);
        setCustomAddress('');
        setSelectedDays([]);
        fetchSubscriptions();
      } else {
        const err = await res.json();
        onError(err.message || 'Cannot create subscription schedule');
      }
    } catch (e) {
      onError('Connection issue creating subscription plan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSubscription = async (id: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(`Subscription #${id} toggled successfully.`);
        fetchSubscriptions();
      }
    } catch (e) {
      onError('Could not toggle subscription at this time.');
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!confirm('Cancel and permanently delete this water subscription contract?')) return;
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onSuccess('Subscription contract cancelled successfully.');
        fetchSubscriptions();
      }
    } catch (e) {
      onError('Deletion of subscription failed.');
    }
  };

  // Inline upgrade implementation
  const startEditing = (sub: SubscriptionContract) => {
    setEditingSubId(sub.id);
    setEditQty(sub.quantity);
    setEditFreq(sub.frequency);
    setEditPayMethod(sub.paymentMethod);
    setEditAddress(sub.address);
    setEditDays(sub.selectedDays || []);
  };

  const cancelEditing = () => {
    setEditingSubId(null);
  };

  const saveUpgrade = async (id: string) => {
    if (editFreq === SubscriptionFrequency.WEEKLY && editDays.length === 0) {
      onError('Please specify at least one day for weekly plan cycles.');
      return;
    }

    try {
      const res = await fetch(`/api/subscriptions/${id}/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantity: editQty,
          frequency: editFreq,
          paymentMethod: editPayMethod,
          address: editAddress,
          selectedDays: editFreq === SubscriptionFrequency.WEEKLY ? editDays : [],
        }),
      });

      if (res.ok) {
        onSuccess('Subscription plan upgraded and saved successfully!');
        setEditingSubId(null);
        fetchSubscriptions();
      } else {
        const data = await res.json();
        onError(data.message || 'Upgrade request rejected.');
      }
    } catch (e) {
      onError('Error upgrading subscription plan.');
    }
  };

  // Fast Auto-Dispatch simulate
  const triggerAutoDispatch = async () => {
    setDispatching(true);
    try {
      const res = await fetch('/api/subscriptions/dispatch-simulation', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data.message || 'Auto-generation cycles completed!');
        fetchSubscriptions();
      }
    } catch (e) {
      onError('Auto-cycle trigger failed.');
    } finally {
      setDispatching(false);
    }
  };

  const toggleDaySelection = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleEditDaySelection = (day: string) => {
    setEditDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Metrics calculators
  const totalSubscribersCount = subscriptions.length;
  const activeSubsCount = subscriptions.filter(s => s.isActive).length;
  const totalSubQuantity = subscriptions.filter(s => s.isActive).reduce((acc, s) => acc + s.quantity, 0);
  const estimatedSubRevenue = subscriptions.filter(s => s.isActive).reduce((acc, s) => acc + (s.totalPrice || 0), 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6" id="sub-manager-card">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wide font-display">
              {(role === 'OWNER' || role === 'ADMIN') ? 'AquaFlow Subscription Management Engine' : 'My Water Subscriptions'}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">INTELLIGENT SCHEDULED CAN REFILLS</p>
          </div>
        </div>

        {(role === 'OWNER' || role === 'ADMIN') && (
          <button
            onClick={triggerAutoDispatch}
            disabled={dispatching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-bold text-xs shadow-sm transform hover:scale-[1.02] active:scale-95 transition-all"
            id="simulation-trigger-btn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${dispatching ? 'animate-spin' : ''}`} />
            Run Daily Auto-Order Generator
          </button>
        )}
      </div>

      {/* Owner Subscriber Analytics Widgets */}
      {(role === 'OWNER' || role === 'ADMIN') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono">Active Subscriptions</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-slate-900 dark:text-white">{activeSubsCount}</span>
              <span className="text-[9px] text-emerald-500 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-1 py-0.2 rounded">/ {totalSubscribersCount} total</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono">Daily Cans Allocated</p>
            <span className="text-lg font-black text-slate-900 dark:text-white">{totalSubQuantity} Cans</span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono">Cycle Base Revenue</p>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">₹{estimatedSubRevenue.toFixed(2)}</span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono">Current Cost Rate</p>
            <span className="text-lg font-black text-indigo-500 dark:text-indigo-400">₹5.00 / Can</span>
          </div>
        </div>
      )}

      {role === 'USER' && (
        <form onSubmit={handleCreateSubscription} className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 rounded-xl border border-slate-150 dark:border-slate-800 space-y-4" id="sub-creation-form">
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-display">
            <Plus className="h-4 w-4 text-cyan-600" /> Start a Scheduled Regular Delivery
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 font-mono">
                Quantity per Dispatch
              </label>
              <input
                type="number"
                min="1"
                max="25"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-black font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 font-mono">
                Flexible Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as SubscriptionFrequency)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-black"
              >
                <option value={SubscriptionFrequency.DAILY}>Every Day (Daily Refills)</option>
                <option value={SubscriptionFrequency.WEEKLY}>Weekly Selection (Custom Days)</option>
                <option value={SubscriptionFrequency.MONTHLY}>Monthly Dispatch Plan</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 font-mono">
                Billing Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-blue-600"
              >
                <option value={PaymentMethod.COD}>Cash on Delivery (COD)</option>
                <option value={PaymentMethod.G_PAY}>Google Pay / UPI QR</option>
                <option value={PaymentMethod.PHONE_PE}>PhonePe Mobile UPI</option>
                <option value={PaymentMethod.BANK_TRANSFER}>Net Bank Transfer</option>
              </select>
            </div>
          </div>

          {frequency === SubscriptionFrequency.WEEKLY && (
            <div className="bg-white dark:bg-slate-900/40 p-3 rounded-lg border border-slate-150 dark:border-slate-850 space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                Select Dispatch Weekdays:
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => {
                  const isChecked = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDaySelection(day)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-full border transition-all ${
                        isChecked 
                          ? 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-300 text-cyan-600'
                          : 'bg-slate-50 dark:bg-slate-850 border-slate-200 text-slate-500 dark:text-slate-400 hover:border-slate-350'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-mono">
              Custom Delivery Address For Subscription Cycles
            </label>
            <input
              type="text"
              placeholder="Leave empty to use your default profile address"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-cyan-500 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold text-xs hover:from-cyan-700 hover:to-blue-700 active:scale-[0.99] transition-all text-center flex items-center justify-center gap-1.5 shadow shadow-cyan-500/10 uppercase tracking-widest font-display"
          >
            {submitting ? 'Creating Automation...' : 'Establish My Recurring Subscription Plan'}
          </button>
        </form>
      )}

      {/* Subscription Active Lists */}
      <div className="space-y-4">
        <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-400 uppercase tracking-wider">Active Deliveries Roster</h4>

        {loading ? (
          <p className="text-center py-6 text-slate-400 dark:text-slate-500 font-mono text-xs">Loading sub rosters...</p>
        ) : subscriptions.length > 0 ? (
          <div className="space-y-4">
            {subscriptions.map((sub) => {
              const isEditing = editingSubId === sub.id;
              const hasExpandedHist = expandedHistSubId === sub.id;

              return (
                <div key={sub.id} className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-850 space-y-3 shadow-2xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-cyan-100/60 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-400 flex items-center justify-center font-mono font-black text-xs">
                        ID
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 dark:text-white text-xs">{sub.id}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black font-mono uppercase ${
                            sub.isActive 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400' 
                              : 'bg-slate-100 text-slate-650 dark:bg-slate-850 dark:text-slate-400'
                          }`}>
                            {sub.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-0.5">
                          Created on {new Date(sub.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {role === 'USER' && (
                        <>
                          <button
                            onClick={() => isEditing ? saveUpgrade(sub.id) : startEditing(sub)}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300 transition-all"
                            title={isEditing ? 'Save Upgrade' : 'Upgrade Plan'}
                          >
                            {isEditing ? <Save className="h-3.5 w-3.5 text-emerald-600" /> : <Edit className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleToggleSubscription(sub.id)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              sub.isActive 
                                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-805 text-slate-600 dark:text-slate-400 hover:bg-slate-50' 
                                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-700'
                            }`}
                            title={sub.isActive ? 'Pause Refills' : 'Resume Refills'}
                          >
                            {sub.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteSubscription(sub.id)}
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/25 border border-red-100 dark:border-red-900 hover:bg-red-100 text-red-650"
                            title="Cancel Subscription"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => setExpandedHistSubId(hasExpandedHist ? null : sub.id)}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-550 flex items-center justify-center"
                        title="View Billing History"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Upgrades Editing Sub Form */}
                  {isEditing ? (
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-cyan-200 space-y-3">
                      <p className="text-[10px] font-black uppercase text-cyan-600 font-mono flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Upgrade / Modify Contract Parameters
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider mb-0.5 text-slate-400">Qty cans</label>
                          <input 
                            type="number"
                            value={editQty}
                            onChange={(e) => setEditQty(Number(e.target.value))}
                            className="w-full bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 text-xs font-bold font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider mb-0.5 text-slate-400">Frequency</label>
                          <select 
                            value={editFreq}
                            onChange={(e) => setEditFreq(e.target.value as SubscriptionFrequency)}
                            className="w-full bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 text-xs font-bold"
                          >
                            <option value={SubscriptionFrequency.DAILY}>Every Day</option>
                            <option value={SubscriptionFrequency.WEEKLY}>Weekly Selection</option>
                            <option value={SubscriptionFrequency.MONTHLY}>Monthly Plan</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold uppercase tracking-wider mb-0.5 text-slate-400">Pay Mode</label>
                          <select 
                            value={editPayMethod}
                            onChange={(e) => setEditPayMethod(e.target.value as PaymentMethod)}
                            className="w-full bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 text-xs font-bold"
                          >
                            <option value={PaymentMethod.COD}>Cash (COD)</option>
                            <option value={PaymentMethod.G_PAY}>Google Pay / UPI</option>
                            <option value={PaymentMethod.PHONE_PE}>PhonePe</option>
                            <option value={PaymentMethod.BANK_TRANSFER}>Bank Wire</option>
                          </select>
                        </div>
                      </div>

                      {editFreq === SubscriptionFrequency.WEEKLY && (
                        <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 space-y-1">
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Select Dispatch Weekdays:</label>
                          <div className="flex flex-wrap gap-1">
                            {DAYS_OF_WEEK.map(day => {
                              const isChecked = editDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleEditDaySelection(day)}
                                  className={`px-2 py-0.5 text-[9px] font-bold rounded-full border transition-all ${
                                    isChecked 
                                      ? 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-300 text-cyan-600'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-550'
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider mb-0.5 text-slate-400">Delivery Location Address</label>
                        <input 
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 text-xs pt-1">
                        <button onClick={cancelEditing} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-650">
                          Cancel
                        </button>
                        <button onClick={() => saveUpgrade(sub.id)} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-bold">
                          Save Upgraded Parameters
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs pt-1 pb-1">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase font-mono">Plan Cycles</p>
                        <div className="flex items-center gap-1.5 mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                          <span className="capitalize">{sub.frequency.toLowerCase()} plan</span>
                          <span className="font-mono text-[10px] bg-cyan-50 dark:bg-cyan-950 text-cyan-650 dark:text-cyan-400 px-1.5 rounded-sm">
                            {sub.quantity} Can{sub.quantity !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase font-mono">Costing Rate</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          ₹{sub.pricePerCan} / unit (₹{(sub.totalPrice || sub.quantity * sub.pricePerCan).toFixed(2)} total)
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase font-mono">Delivery Day Rule</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 max-w-[170px] truncate">
                          {sub.frequency === SubscriptionFrequency.WEEKLY 
                            ? (sub.selectedDays?.join(', ') || 'No days picked') 
                            : 'Every day sequentially'
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase font-mono">Next Estimated Drop</p>
                        <p className="font-bold text-indigo-700 dark:text-indigo-400 mt-0.5 font-mono">
                          {sub.nextDeliveryDate || sub.lastDispatchedDate 
                            ? (sub.nextDeliveryDate || new Date(new Date(sub.lastDispatchedDate!).getTime() + 24 * 3600 * 1000).toISOString().split('T')[0])
                            : 'Tomorrow Morning'
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-850 truncate shrink-0 flex items-center gap-1">
                      <span className="font-bold text-slate-400">Cycle Destination Point:</span> {sub.address}
                    </div>
                  )}

                  {/* Payment History Log Drawer */}
                  {hasExpandedHist && (
                    <div className="mt-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 space-y-2">
                      <p className="text-[10px] font-black uppercase text-indigo-600 font-mono flex items-center gap-1">
                        <History className="h-3 w-3" /> Delivery Payment History & Dispatch logs
                      </p>
                      {sub.paymentHistory && sub.paymentHistory.length > 0 ? (
                        <div className="space-y-1.5 text-[11px]">
                          {sub.paymentHistory.map((hist: any, index: number) => (
                            <div key={hist.id || index} className="flex items-center justify-between py-1 border-b border-dashed border-slate-100 last:border-b-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-slate-400">#{hist.id}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">₹{hist.amount.toFixed(2)}</span>
                                <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded font-mono">{hist.paymentMethod}</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono text-[10px]">
                                <span className="text-slate-400">{new Date(hist.date).toLocaleDateString()}</span>
                                <span className={`font-bold uppercase ${
                                  hist.status === 'PAID' ? 'text-emerald-500' : 'text-orange-500'
                                }`}>
                                  [{hist.status}]
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-2 text-center text-slate-400 text-[10px] font-mono">
                          No transaction states recorded yet for this active client card.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-550">
            <p className="text-xs">No regular active subscription schedule found.</p>
            <p className="text-[10px] text-slate-400 mt-1">Configure a daily/weekly preset and let AquaFlow keep your water can supply filled!</p>
          </div>
        )}
      </div>
    </div>
  );
}
