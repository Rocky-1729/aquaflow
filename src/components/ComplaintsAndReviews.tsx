import React, { useState, useEffect } from 'react';
import { ShieldAlert, Star, MessageSquare, Plus, CheckCircle, Clock, Send, Sparkles } from 'lucide-react';
import { ComplaintTicket, OrderReview, Order, OrderStatus } from '../types';

interface ComplaintsAndReviewsProps {
  token: string | null;
  role: 'USER' | 'OWNER' | 'DELIVERY' | 'ADMIN';
  orders: Order[];
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function ComplaintsAndReviews({ token, role, orders, onError, onSuccess }: ComplaintsAndReviewsProps) {
  // Lists
  const [complaints, setComplaints] = useState<ComplaintTicket[]>([]);
  const [reviews, setReviews] = useState<OrderReview[]>([]);
  
  // Submit state - Complaints
  const [ticketOrderId, setTicketOrderId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Submit state - Reviews
  const [reviewOrderId, setReviewOrderId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComments, setReviewComments] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Resolve state - Owner
  const [resolveTexts, setResolveTexts] = useState<{ [ticketId: string]: string }>({});

  useEffect(() => {
    fetchComplaints();
    fetchReviews();
  }, [token, role]);

  const fetchComplaints = async () => {
    try {
      const endpoint = role === 'OWNER' ? '/api/complaints/all' : '/api/complaints';
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setComplaints(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/reviews', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReviews(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketOrderId) {
      onError('Please specify which order ID your ticket is regarding.');
      return;
    }
    setIsSubmittingTicket(true);
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: ticketOrderId,
          subject: ticketSubject,
          message: ticketMessage,
        }),
      });

      if (res.ok) {
        onSuccess('Complaint ticket logged! Our operations desk will investigate immediately.');
        setTicketOrderId('');
        setTicketSubject('');
        setTicketMessage('');
        fetchComplaints();
      } else {
        const err = await res.json();
        onError(err.message || 'Failed log ticket.');
      }
    } catch (e) {
      onError('Connection error lodging support issue.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewOrderId) {
      onError('Please choose an order to rate and review.');
      return;
    }
    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: reviewOrderId,
          rating: reviewRating,
          comments: reviewComments,
        }),
      });

      if (res.ok) {
        onSuccess('Review submitted! Thank you for rating our delivery.');
        setReviewOrderId('');
        setReviewComments('');
        setReviewRating(5);
        fetchReviews();
      } else {
        const err = await res.json();
        onError(err.message || 'Failed log review.');
      }
    } catch (e) {
      onError('Connection error lodging feedback.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    const responseText = resolveTexts[ticketId] || 'Issue investigated and rectified.';
    try {
      const res = await fetch(`/api/complaints/${ticketId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ responseMessage: responseText }),
      });

      if (res.ok) {
        onSuccess('Ticket safely resolved and client notified!');
        setResolveTexts((prev) => ({ ...prev, [ticketId]: '' }));
        fetchComplaints();
      } else {
        const err = await res.json();
        onError(err.message || 'Resolution failed.');
      }
    } catch (e) {
      onError('Connection error submitting ticket resolution.');
    }
  };

  // Filter completed/delivered orders that can be rated
  const completedOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="tickets-and-ratings-section">
      {/* LEFT: COMPLAINTS / TICKETING WORKFLOW */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm" id="complaints-desk-box">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
          <div className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 flex items-center justify-center font-bold">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-display">
              Resolution Ticketing Helpdesk
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Operations dispute logger</p>
          </div>
        </div>

        {role === 'USER' && (
          <form onSubmit={handleSubmitTicket} className="mb-6 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850 space-y-3" id="lodge-complaint-form">
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
              Lodge Delivery Complaint Ticket
            </h4>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                Select Order ID
              </label>
              <select
                value={ticketOrderId}
                onChange={(e) => setTicketOrderId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 focus:outline-none focus:border-red-500 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                required
              >
                <option value="">-- Select Damaged / Missed Order --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    Order #{o.id} ({o.quantity} Cans - {o.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                  Issue Summary (Subject)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Can leakage, delayed delivery, empty can, etc."
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 focus:outline-none focus:border-red-500 rounded-lg px-2.5 py-1.5 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                  Detailed Complaint message
                </label>
                <textarea
                  placeholder="Specify what went wrong and your preferred compensation mode."
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs min-h-[50px] leading-relaxed"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingTicket}
              className="w-full py-2 bg-red-650 hover:bg-red-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all"
            >
              Log Dispute Ticket
            </button>
          </form>
        )}

        {/* Complaints Ticket Logs */}
        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
          {complaints.length > 0 ? (
            complaints.map((ticket) => (
              <div key={ticket.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850 text-xs">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-mono text-[10px] text-red-500 font-extrabold">TICKET ID: {ticket.id}</span>
                    <h5 className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{ticket.subject}</h5>
                    <p className="text-[10px] text-slate-400 font-medium">Order Reference ID: {ticket.orderId}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                    ticket.status === 'RESOLVED' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-red-100 text-red-800 animate-pulse'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="text-slate-650 dark:text-slate-400 leading-relaxed italic border-l-2 border-slate-300 dark:border-slate-800 pl-2 py-0.5">
                  &ldquo;{ticket.message}&rdquo;
                </p>

                {ticket.responseMessage && (
                  <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded text-[11px]">
                    <strong className="text-emerald-850 dark:text-emerald-400 font-bold block mb-0.5">Operator Resolution:</strong>
                    <p className="text-slate-700 dark:text-slate-350">{ticket.responseMessage}</p>
                  </div>
                )}

                {role === 'OWNER' && ticket.status === 'PENDING' && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Enter resolution actions..."
                      value={resolveTexts[ticket.id] || ''}
                      onChange={(e) => setResolveTexts({ ...resolveTexts, [ticket.id]: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 px-2 py-1 rounded text-xs flex-1"
                    />
                    <button
                      onClick={() => handleResolveTicket(ticket.id)}
                      className="px-2.5 py-1 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-bold rounded text-xs hover:bg-slate-800 transition-colors shrink-0"
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-center py-6 text-slate-400 text-xs">No dispute files are pending processing.</p>
          )}
        </div>
      </div>

      {/* RIGHT: RATING & REVIEWS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm" id="ratings-reviews-box">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
          <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-display">
              Order Ratings and Feedback
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Service satisfaction tracker</p>
          </div>
        </div>

        {role === 'USER' && (
          <form onSubmit={handleSubmitReview} className="mb-6 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850 space-y-3" id="submit-review-form">
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight flex items-center gap-1">
              Share Delivery rating
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">
                  Delivered Order ID
                </label>
                <select
                  value={reviewOrderId}
                  onChange={(e) => setReviewOrderId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 focus:outline-none focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs font-medium"
                  required
                >
                  <option value="">-- Select Order --</option>
                  {completedOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      Order #{o.id} ({o.quantity} Cans)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">
                  Select Rating Score
                </label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 focus:outline-none focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs font-bold text-amber-600"
                >
                  <option value="5">⭐⭐⭐⭐⭐ Excellent (5/5)</option>
                  <option value="4">⭐⭐⭐⭐ Great (4/5)</option>
                  <option value="3">⭐⭐⭐ Good Average (3/5)</option>
                  <option value="2">⭐⭐ Poor Quality (2/5)</option>
                  <option value="1">⭐ Critical Issue (1/5)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">
                Comments and Remarks
              </label>
              <input
                type="text"
                placeholder="Rider was courteous, super fast dispatch, clean cans etc."
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingReview}
              className="w-full py-2 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all"
            >
              Submit Service Rating
            </button>
          </form>
        )}

        {/* Review Comments list */}
        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
          {reviews.length > 0 ? (
            reviews.map((rev) => (
              <div key={rev.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850 text-xs">
                <div className="flex justify-between items-center mb-1 bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{rev.customerName || 'Anonymous Account'}</span>
                    <span className="text-[9px] text-slate-400 font-mono block">Delivered Order: #{rev.orderId}</span>
                  </div>
                  <div className="flex text-amber-500 font-mono tracking-tighter text-xs">
                    {'★'.repeat(rev.rating)}
                    {'☆'.repeat(5 - rev.rating)}
                  </div>
                </div>
                <p className="text-slate-650 dark:text-slate-350 leading-relaxed font-sans pt-1">
                  &ldquo;{rev.comments}&rdquo;
                </p>
                <div className="text-[8px] text-slate-400 mt-1 font-mono text-right font-light">
                  {new Date(rev.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center py-6 text-slate-400 text-xs">No client surveys received yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
