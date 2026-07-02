export const mockCashflow = [
  { month: 'Feb', income: 118000, expense: 76000 },
  { month: 'Mar', income: 121000, expense: 82000 },
  { month: 'Apr', income: 119500, expense: 71000 },
  { month: 'May', income: 124000, expense: 89000 },
  { month: 'Jun', income: 122500, expense: 79500 },
  { month: 'Jul', income: 128000, expense: 74300 },
]

export const mockBudgets = [
  { id: '1', category: 'Groceries', color: '#f97316', spent: 8200, limit: 10000 },
  { id: '2', category: 'Dining Out', color: '#eab308', spent: 6100, limit: 6000 },
  { id: '3', category: 'Transportation', color: '#f97316', spent: 2400, limit: 5000 },
  { id: '4', category: 'Entertainment', color: '#eab308', spent: 1800, limit: 4000 },
]

export const mockBills = [
  { id: '1', label: 'HDFC Credit Card', amount: 24580, dueInDays: 2, kind: 'credit_due' as const },
  { id: '2', label: 'Netflix', amount: 649, dueInDays: 4, kind: 'subscription' as const },
  { id: '3', label: 'Home Loan EMI', amount: 32100, dueInDays: 6, kind: 'bill' as const },
]

export const mockActivity = [
  { id: '1', merchant: 'Blue Tokai Coffee', category: 'Dining Out', amount: -420, date: 'Today', color: '#eab308' },
  { id: '2', merchant: 'Salary — Acme Corp', category: 'Salary', amount: 128000, date: 'Yesterday', color: '#22c55e' },
  { id: '3', merchant: 'Amazon', category: 'Shopping', amount: -2340, date: 'Yesterday', color: '#eab308' },
  { id: '4', merchant: 'BESCOM', category: 'Utilities', amount: -1860, date: '2 days ago', color: '#f97316' },
  { id: '5', merchant: 'Zerodha SIP — Flexi Cap', category: 'Mutual Funds', amount: -5000, date: '3 days ago', color: '#38bdf8' },
]

export const mockKpis = {
  netWorth: 1834200,
  netWorthChangePct: 4.2,
  savingsRate: 43,
  creditUtilization: 28,
  healthScore: 78,
}
