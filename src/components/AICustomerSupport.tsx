import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageCircle, X, ServerCrash, Bot, User, HelpCircle } from 'lucide-react';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface AICustomerSupportProps {
  token: string | null;
  userName?: string;
}

export default function AICustomerSupport({ token, userName }: AICustomerSupportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: `Hello ${userName || 'Valued Customer'}! 💧 Welcome to AquaFlow AI Helpdesk. How can I assist you with your water deliveries, subscriptions, leak reports or pricing queries today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userText = userInput.trim();
    setUserInput('');

    const newMsg: Message = {
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userText }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: Message = {
          sender: 'bot',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        // Fallback response generator if server is down or key is blank
        throw new Error();
      }
    } catch (err) {
      setTimeout(() => {
        const fallbackMsg: Message = {
          sender: 'bot',
          text: getLocalFallbackResponse(userText),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      }, 1000);
    } finally {
      setIsTyping(false);
    }
  };

  const getLocalFallbackResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('price') || q.includes('cost') || q.includes('rate')) {
      return "💧 **AquaFlow Pricing Policy:** Our current pricing is calculated at a flat base rate per 20 Liters standard sterile water can (configured in real-time by store management). There are no secondary shipping or service fees. You can view the current rate in your Quick Order portal!";
    }
    if (q.includes('sub') || q.includes('recur') || q.includes('daily') || q.includes('weekly')) {
      return "📅 **Subscriptions Manager:** You can easily set up automated recurring orders in our **Subscription Center**! Choose between Daily, Weekly, or Monthly dispatch schedules, select your payment method, and avoid manual orders. We'll handle everything automatically!";
    }
    if (q.includes('track') || q.includes('where') || q.includes('location') || q.includes('agent')) {
      return "📍 **Live Route Tracking:** When our Owner assigns an order to a delivery driver and the driver marks it as **Out for Delivery**, you can monitor their simulated GPS coordinate stream live on our Leaflet spatial map tracker!";
    }
    if (q.includes('dispute') || q.includes('refund') || q.includes('wrong') || q.includes('leak') || q.includes('issue')) {
      return "⚠️ **Dispute Resolution:** Oh no! We apologize for any inconvenience. Please log a complaint with complete details in the **Dispute Ticketing Box** right under your dashboard. Our management reviews tickets instantly and initiates swift resolution/refund actions!";
    }
    if (q.includes('gpay') || q.includes('pay') || q.includes('razorpay') || q.includes('payment')) {
      return "💳 **Secure Settlement Gateway:** AquaFlow accepts Cash on Delivery (COD), Google Pay, PhonePe, and major credit cards securely. For Cash on Delivery, your paid state upgrades on the server as soon as the driver marks the order as DELIVERED.";
    }
    return "💡 **AquaFlow Concierge:** I am here to help ensure hassle-free clean hydration! For detailed enquiries about routes, damaged cans, bulk orders, or customizable daily routines, feel free to use the specific modules in your AquaFlow dashboard.";
  };

  return (
    <>
      {/* Floating Sparkly Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[99] h-12 w-12 sm:h-14 sm:w-14 bg-sky-500 text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-[1.1] active:scale-95 cursor-pointer border-4 border-white dark:border-slate-800 ring-4 ring-sky-500/20"
        id="ai-helpdesk-trigger-btn"
        title="AquaFlow AI Helpdesk"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6 animate-pulse" />}
      </button>

      {/* Floating Chat Container */}
      {isOpen && (
        <div 
          className="fixed bottom-20 sm:bottom-24 right-4 sm:right-6 z-[99] w-[calc(100vw-32px)] sm:w-[400px] h-[450px] sm:h-[480px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn"
          id="ai-chatbox-widget"
        >
          {/* Header Banner */}
          <div className="bg-slate-900 dark:bg-slate-950 p-4 text-white flex justify-between items-center bg-gradient-to-r from-slate-900 to-sky-950">
            <div className="flex items-center gap-2">
              <div className="h-8.5 w-8.5 bg-sky-500 text-white rounded-lg flex items-center justify-center">
                <Sparkles className="h-4.5 w-4.5 fill-white-500" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider">AquaFlow Support AI</h4>
                <p className="text-[9px] text-sky-400 font-mono">Live Gemini Natural Agent</p>
              </div>
            </div>

            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50 dark:bg-slate-950/20">
            {messages.map((m, idx) => {
              const isBot = m.sender === 'bot';
              return (
                <div key={idx} className={`flex ${isBot ? 'justify-start' : 'justify-end'} gap-2.5`}>
                  {isBot && (
                    <div className="h-7 w-7 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center text-xs shrink-0 font-bold self-end">
                      AI
                    </div>
                  )}

                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    isBot 
                      ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-250 rounded-bl-none shadow-sm' 
                      : 'bg-sky-500 text-white rounded-br-none shadow-sm shadow-sky-500/10 font-medium'
                  }`}>
                    {/* Convert basic markdowns like bolding manually */}
                    <div className="whitespace-pre-wrap">
                      {m.text.split('**').map((chunk, chunkIdx) => {
                        return chunkIdx % 2 === 1 ? <strong key={chunkIdx} className="font-extrabold">{chunk}</strong> : chunk;
                      })}
                    </div>
                    <span className={`block text-[8px] text-right mt-1.5 font-mono ${isBot ? 'text-slate-400' : 'text-sky-200'}`}>
                      {m.timestamp}
                    </span>
                  </div>

                  {!isBot && (
                    <div className="h-7 w-7 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full flex items-center justify-center text-xs shrink-0 font-bold self-end">
                      Me
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex justify-start gap-2.5">
                <div className="h-7 w-7 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center text-xs shrink-0 font-bold">
                  AI
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl rounded-bl-none px-3 py-2">
                  <div className="flex gap-1 py-1">
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Fast recommendation chips */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-1.5 overflow-x-auto whitespace-nowrap text-[10px] scrollbar-none">
            <button
               onClick={() => setUserInput("How to set up pricing?")}
               className="px-2.5 py-1 border border-slate-200 dark:border-slate-800 text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full flex items-center gap-1 font-medium select-none"
            >
              <HelpCircle className="h-3 w-3 text-sky-500" /> Pricing policy?
            </button>
            <button
               onClick={() => setUserInput("I want to create regular subscription")}
               className="px-2.5 py-1 border border-slate-200 dark:border-slate-800 text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full flex items-center gap-1 font-medium select-none"
            >
              <HelpCircle className="h-3 w-3 text-orange-500" /> Subscriptions plan?
            </button>
            <button
               onClick={() => setUserInput("My can is leaking/empty. I need dispute compensation.")}
               className="px-2.5 py-1 border border-slate-200 dark:border-slate-800 text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full flex items-center gap-1 font-medium select-none"
            >
              <HelpCircle className="h-3 w-3 text-red-500" /> Leakage complaint?
            </button>
          </div>

          {/* Send Area */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
            <input
              type="text"
              placeholder="Ask anything about AquaFlow operations..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 focus:outline-none focus:border-sky-500 rounded-xl px-3.5 py-2 text-xs"
              id="ai-support-text-input"
            />
            <button 
              type="submit" 
              className="h-8.5 w-8.5 bg-sky-500 text-white rounded-xl flex items-center justify-center hover:bg-sky-600 transition-colors"
              id="ai-support-send-btn"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
