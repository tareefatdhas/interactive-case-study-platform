# Interactive Case Study Platform

The most beautiful and intuitive platform for delivering interactive case studies with student grade tracking.

## 🌟 Features

- **QR Code Access** - Students join instantly by scanning a QR code, no passwords required
- **Progressive Reading** - Content delivered section by section with embedded questions
- **Student ID Tracking** - Participation and grades tracked over time with detailed analytics
- **Beautiful Design** - Minimal, elegant, mobile-first interface optimized for reading
- **Real-time Updates** - Live progress monitoring and instant session management
- **Teacher Analytics** - Comprehensive insights and grading dashboard with CSV export

## 🚀 Tech Stack

- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS
- **Backend:** Firebase Firestore + Authentication
- **Real-time:** Firebase listeners for live updates  
- **QR Codes:** react-qr-code for generation
- **Hosting:** Vercel (recommended)

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled
- Git

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd case-study-platform
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Firestore Database** and **Authentication**
3. In Authentication, enable **Email/Password** sign-in method
4. Copy your Firebase configuration

### 4. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

### 5. Deploy Firestore Security Rules

Deploy the security rules to your Firebase project:

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (select Firestore)
firebase init

# Deploy security rules
firebase deploy --only firestore:rules
```

### 6. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📖 Usage Guide

### For Teachers

1. **Sign Up/Sign In**
   - Create a teacher account at `/signup`
   - Sign in at `/login`

2. **Create Case Studies**
   - Navigate to Dashboard > Case Studies > Create New
   - Add sections with rich content (markdown supported)
   - Add questions with point values for each section

3. **Start Sessions**
   - Go to Dashboard > Sessions > Start New
   - Select a case study and generate a session code
   - Share the QR code or session code with students

4. **Monitor Progress**
   - View real-time student progress
   - See response submissions live
   - End sessions when complete

### For Students

1. **Join Sessions**
   - Visit `/join` and enter the 6-digit session code
   - Or scan the QR code displayed by your instructor
   - Enter your Student ID and name for tracking

2. **Complete Case Studies**
   - Read each section carefully
   - Answer all questions before proceeding
   - Submit responses for grading

## 🏗️ Project Structure

```
case-study-platform/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Authentication pages
│   │   ├── dashboard/         # Teacher dashboard
│   │   ├── session/[code]/    # Student session view
│   │   └── join/              # Session joining page
│   ├── components/            # React components
│   │   ├── ui/               # Design system components
│   │   ├── teacher/          # Teacher-specific components
│   │   └── student/          # Student-specific components
│   ├── lib/                   # Core utilities
│   │   ├── firebase/         # Firebase configuration & services
│   │   ├── hooks/            # Custom React hooks
│   │   └── utils/            # Helper functions
│   └── types/                # TypeScript definitions
├── public/                   # Static assets
├── firestore.rules          # Firebase security rules
└── README.md
```

## 🎨 Design System

### Colors
- **Primary:** Deep Blue (#1a365d) - Trust, academic
- **Background:** Warm White (#fafafa) - Clean
- **Accent:** Success Green (#38a169) - Progress  
- **Text:** Charcoal (#2d3748) - Readable

### Typography
- **Headers:** Inter - Clean, modern interface font
- **Reading Content:** Charter - Optimized for long-form reading
- **UI Elements:** System fonts for fast loading

### Key Principles
- Mobile-first responsive design
- Generous whitespace for focus
- Subtle animations (200ms transitions)
- Clear hierarchy with consistent spacing
- Content-first approach

## 🔒 Security

- Firebase security rules restrict access appropriately
- Teachers can only access their own content
- Students can only view active sessions
- No sensitive data exposed to unauthorized users
- Input validation on all forms

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Alternative: Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**Firebase Connection Errors**
- Verify your Firebase configuration in `.env.local`
- Ensure Firestore and Authentication are enabled
- Check that security rules are deployed

**Build Errors**
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Next.js cache: `rm -rf .next`
- Update dependencies: `npm update`

**Authentication Issues**
- Verify Email/Password is enabled in Firebase Auth
- Check that users are being created in Firebase Console
- Ensure security rules allow teacher document creation

### Getting Help

- Check the Issues for known problems
- Create a new issue with detailed reproduction steps

---

Built with ❤️ for educators who want to create engaging learning experiences.
