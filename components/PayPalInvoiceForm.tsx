// import React, { useState, ChangeEvent, FormEvent } from 'react';

// interface InvoiceItem {
//     name: string;
//     quantity: number;
//     unit_price: {
//         currency: string;
//         value: string;
//     };
// }

// interface InvoiceData {
//     merchant_info: { email: string };
//     billing_info: { email: string }[];
//     items: InvoiceItem[];
//     note: string;
//     terms: string;
// }

// const PaypalInvoiceForm: React.FC = () => {
//     const [email, setEmail] = useState<string>('');
//     const [itemName, setItemName] = useState<string>('');
//     const [amount, setAmount] = useState<string>('');
//     const [sending, setSending] = useState<boolean>(false);
//     const [status, setStatus] = useState<string>('');

//     const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//         e.preventDefault();
//         setSending(true);
//         setStatus('');

//         const invoiceData: InvoiceData = {
//             merchant_info: { email: 'yourmerchant@example.com' }, // Your business PayPal email
//             billing_info: [{ email }],
//             items: [{ name: itemName, quantity: 1, unit_price: { currency: 'USD', value: amount } }],
//             note: 'Thank you for your business!',
//             terms: 'No refund after payment.'
//         };

//         try {
//             const res = await fetch('/api/invoice', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(invoiceData)
//             });
//             const data = await res.json();

//             if (data.id) {
//                 setStatus(`Invoice sent! PayPal Invoice ID: ${data.id}`);
//             } else {
//                 setStatus(`Error: ${data.error || 'Unknown error'}`);
//             }
//         } catch (err) {
//             setStatus('Error sending invoice');
//         } finally {
//             setSending(false);
//         }
//     };

//     return (
//         <form onSubmit={handleSubmit} style={{ maxWidth: 420, margin: '32px auto 0 auto', background: '#fff', padding: 16, borderRadius: 8 }}>
//             <h2>PayPal Invoice Generator</h2>
//             <label htmlFor="customerEmail">Email of customer:</label>
//             <input
//                 id="customerEmail"
//                 value={email}
//                 onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
//                 required
//                 type="email"
//             />
//             <label htmlFor="itemName">Item Name:</label>
//             <input
//                 id="itemName"
//                 value={itemName}
//                 onChange={(e: ChangeEvent<HTMLInputElement>) => setItemName(e.target.value)}
//                 required
//             />
//             <label htmlFor="amount">Amount (USD):</label>
//             <input
//                 id="amount"
//                 value={amount}
//                 onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
//                 required
//                 type="number"
//                 step="0.01"
//             />
//             <button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send PayPal Invoice'}</button>
//             <div style={{ marginTop: 12, color: '#2563eb' }}>{status}</div>
//         </form>
//     );
// };

// export default PaypalInvoiceForm;
