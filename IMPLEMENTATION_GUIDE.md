# MyDuka App - Implementation Guide

Production-grade shop management application with React, TypeScript, Firebase, and Capacitor.

## Project Structure

```
MyDuka/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx          # Email/password login
│   │   │   ├── SignupScreen.tsx         # Account creation with shop setup
│   │   │   └── PhoneAuthScreen.tsx      # Phone verification with OTP
│   │   ├── layout/
│   │   │   ├── MainLayout.tsx           # App wrapper with header & nav
│   │   │   └── BottomNav.tsx            # Bottom tab navigation
│   │   └── common/
│   │       ├── LoadingSpinner.tsx       # Loading state UI
│   │       ├── EmptyState.tsx           # Empty data UI
│   │       └── ConfirmDialog.tsx        # Confirmation modal
│   ├── pages/
│   │   ├── HomePage.tsx                 # Dashboard with summaries
│   │   ├── SalesPage.tsx                # Record & view sales
│   │   ├── ExpensesPage.tsx             # Record & view expenses
│   │   ├── StockPage.tsx                # Manage inventory
│   │   ├── ReportsPage.tsx              # Analytics & PDF export
│   │   └── ProfilePage.tsx              # User profile & shop manager
│   ├── services/
│   │   ├── firebaseService.ts           # Firebase init & config
│   │   ├── authService.ts               # Auth functions (sign up/in/out)
│   │   ├── shopService.ts               # Shop, sales, expenses, stock CRUD
│   │   └── reportService.ts             # PDF generation & charts
│   ├── store/
│   │   └── authStore.ts                 # Zustand auth state (user, shops)
│   ├── context/
│   │   └── authStore.ts                 # Auth context (duplicate of store)
│   ├── types/
│   │   └── index.ts                     # TypeScript interfaces
│   ├── utils/
│   │   └── dateUtils.ts                 # Date formatting utilities
│   ├── App.tsx                          # Main app with routing
│   ├── main.tsx                         # React entry point
│   └── index.css                        # Global styles + Tailwind
├── capacitor.config.ts                  # Capacitor configuration
├── tailwind.config.js                   # Tailwind CSS config
├── postcss.config.js                    # PostCSS config
├── vite.config.js                       # Vite build config
└── package.json                         # Dependencies & scripts

```

## Key Features

### Authentication
- **Email/Password Sign Up & Login** - Firebase Auth with profile creation
- **Phone Number Auth** - OTP verification with reCAPTCHA
- **Persistent Sessions** - Auto login on app restart
- **Profile Management** - User info stored in Firestore

### Shop Management
- **Multi-Shop Support** - Users can own multiple shops, managed via firebaseUid
- **Shop Creation** - Automatic during signup with business details
- **Shop Switching** - Profile page shows all shops, quick switching

### Core Operations
- **Sales Recording** - Product, quantity, unit, price with calculations
- **Expense Tracking** - Categories: Rent, Utilities, Supplies, Wages, Misc
- **Stock Management** - Inventory tracking with low stock alerts (<10 units)
- **Date Filtering** - Filter sales/expenses by date range

### Reports & Analytics
- **Dashboard Charts** - Line/bar/pie charts with Recharts
- **Period Summaries** - Daily, weekly, monthly aggregates
- **PDF Reports** - Exportable reports with transactions
- **Paywall** - Premium reports require payment (cloud function integration ready)

### Data Consistency
- **Cross-Platform Sync** - WhatsApp USSD, Web (Cyber), and Mobile app write to same Firestore
- **Real-Time Updates** - Zustand + Firestore listeners
- **Soft Deletes** - Records marked as deleted, not permanently removed

## Firebase Collections Structure

```
Firestore:
├── users/{uid}
│   ├── email
│   ├── phone
│   ├── name
│   ├── createdAt
│   └── lastLogin

├── shops/{shopId}
│   ├── ownerName
│   ├── shopName
│   ├── location
│   ├── phone
│   ├── email
│   ├── businessType
│   ├── firebaseUid (links shop to user)
│   ├── createdVia (whatsapp/cyber/app)
│   ├── status (active/suspended/pending)
│   │
│   ├── sales/{saleId}
│   │   ├── productName
│   │   ├── quantity
│   │   ├── unit
│   │   ├── pricePerUnit
│   │   ├── totalPrice
│   │   ├── timestamp
│   │   ├── createdVia
│   │   ├── deleted (soft delete)
│   │   └── deletedAt
│   │
│   ├── expenses/{expenseId}
│   │   ├── category
│   │   ├── amount
│   │   ├── timestamp
│   │   ├── createdVia
│   │   ├── deleted
│   │   └── deletedAt
│   │
│   └── stocks/{dateCode}
│       ├── [productName]
│       │   ├── quantity
│       │   ├── unit
│       │   └── lastUpdated
```

## Routes

### Public Routes
- `/login` - Sign in with email/password
- `/signup` - Create account and shop
- `/phone-auth` - Phone number verification

### Protected Routes (require authentication)
- `/home` - Dashboard with stats and recent activity
- `/sales` - Record and view sales
- `/expenses` - Record and view expenses
- `/stock` - Manage inventory
- `/reports` - Analytics, charts, and PDF export
- `/profile` - User profile and shop management

## Installation & Setup

### 1. Prerequisites
- Node.js 18+ and npm
- Android SDK (for mobile build)
- Firebase project with auth enabled

### 2. Install Dependencies
```bash
cd MyDuka
npm install
```

### 3. Update Firebase Config
Edit `src/services/firebaseService.ts` with your Firebase credentials:
```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ... other config
};
```

### 4. Setup Firebase
- Enable Email/Password auth
- Enable Phone auth
- Create Firestore database (rules below)
- Enable Cloud Storage (for PDF files)

### 5. Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Shops - write if user is owner
    match /shops/{shopId} {
      allow read: if request.auth.uid == resource.data.firebaseUid;
      allow create: if request.auth.uid != null;
      allow update, delete: if request.auth.uid == resource.data.firebaseUid;

      // Sales, Expenses, Stocks under shops
      match /{document=**} {
        allow read, write: if request.auth.uid == get(/databases/$(database)/documents/shops/$(shopId)).data.firebaseUid;
      }
    }
  }
}
```

## Development

### Start Dev Server
```bash
npm run dev
```
Open http://localhost:5173

### Build for Web
```bash
npm run build
npm run preview
```

### Build for Android

#### Option 1: First Time Setup
```bash
npm run cap:add:android
```

#### Option 2: Rebuild Existing Project
```bash
npm run cap:build
npm run cap:open
```

Then open Android Studio and build APK/AAB.

## Data Flow & API Usage

### Creating a Shop (Signup)
```
User enters email/password/shop details
→ signUpWithEmail() creates Firebase Auth user
→ createShop() saves shop to Firestore with firebaseUid
→ User redirected to /home
```

### Recording Sales
```
User fills form (product, qty, price)
→ recordSale() saves to shops/{shopId}/sales/{saleId}
→ Real-time update reflected in SalesPage
→ Data syncs with WhatsApp USSD via same Firestore
```

### Loading User Shops
```
useAuthStore() initializes
→ onAuthStateChanged() detects logged-in user
→ getUserShops(uid) fetches all shops where firebaseUid matches
→ selectedShop state in ProfilePage allows switching
```

### Generating Reports
```
User selects date range
→ getSales() + getExpenses() fetch data
→ Charts render with Recharts
→ User clicks "Download PDF"
→ createReportPDF() generates with jsPDF
→ Browser downloads file
```

## State Management

Using Zustand store (`src/store/authStore.ts`):
```typescript
- user: Current Firebase Auth user
- userProfile: User details from Firestore
- isLoading: Auth initialization state
- isAuthenticated: Boolean for route guards
- initializeAuth(): Setup auth listener
- setUser(), setUserProfile(): Update state
```

## Styling

- **Framework**: Tailwind CSS v4
- **Colors**: Dark theme (gray-900 base, cyan/purple accents)
- **Mobile**: Bottom navigation with safe area support
- **Responsive**: Mobile-first, tablet-optimized

## Error Handling

All async operations include:
- Try-catch blocks
- User-friendly error messages via React Toastify
- Loading states during operations
- Form validation before submission
- Confirmation dialogs for destructive actions

## Testing Checklist

- [ ] Signup creates user and shop
- [ ] Login with email works
- [ ] Phone auth OTP flow works
- [ ] Recording sales saves to Firestore
- [ ] Recording expenses saves to Firestore
- [ ] Sales/expenses filterable by date
- [ ] Stock updates persist
- [ ] Reports show correct data
- [ ] PDF exports without errors
- [ ] Multiple shops can be created/switched
- [ ] Logout clears auth state
- [ ] App works on Android device

## Deployment

### Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

### Google Play Store
1. Build APK: `npm run cap:build` → Android Studio → Build → Generate Signed APK
2. Create app on Google Play Console
3. Upload APK and fill store listing
4. Submit for review

## Cloud Functions (Next Phase)

The app is ready for:
- `chargeCustomer()` - Charge shop owners for premium reports
- `chargeShop()` - Charge shops for usage
- `generatePDF()` - Server-side PDF generation for large reports

See `/functions` directory for implementation.

## Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Capacitor Issues
```bash
# Reset Android project
rm -rf android
npm run cap:add:android
npm run cap:build
```

### Firebase Connection Issues
- Verify Firebase config in `firebaseService.ts`
- Check Firestore security rules
- Enable required auth providers
- Check browser console for errors

## Environment Variables

Create `.env` (optional for local Firebase emulator):
```
VITE_FIREBASE_CONFIG=... (JSON string)
VITE_USE_EMULATOR=false
```

## Performance Optimization

- Lazy load routes with React Router
- Zustand store prevents unnecessary re-renders
- Firestore indexes for date-range queries
- PDF generation done client-side
- Images optimized for mobile

## License

Proprietary - Cogvana 2025

## Support

For issues or questions, refer to:
- Firebase docs: https://firebase.google.com/docs
- React Router: https://reactrouter.com/
- Capacitor: https://capacitorjs.com/
- Tailwind: https://tailwindcss.com/
