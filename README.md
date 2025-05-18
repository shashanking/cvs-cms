# CVS CMS

A comprehensive web application for managing proposals, plans, projects, and team collaboration. Features real-time notifications, event management, and document handling with robust audit logging.

## 🚀 Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes
- **Database & Auth**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **UI Components**: Custom built with Tailwind-inspired styling
- **Real-time Updates**: Supabase Realtime
- **Calendar**: FullCalendar integration

## ✨ Key Features

### Project & File Management
- **Project Workspaces**: Dedicated spaces for each project with custom folder structures
- **File Handling**: Upload, preview, and manage files with version history
- **Audit Logging**: Comprehensive tracking of all file operations
- **Role-based Access Control**: Granular permissions for team members

### Event & Task Management
- **Calendar View**: Visualize and manage project events and deadlines
- **Event Notifications**: Get alerted about upcoming events and changes
- **Task Assignment**: Assign and track tasks with due dates and priorities
- **Real-time Updates**: See changes instantly across all connected clients

### Collaboration Tools
- **Team Chat**: Real-time messaging within projects
- **Mentions & Notifications**: Get notified when mentioned in discussions
- **Activity Feed**: Track all project activities in one place
- **Comment Threads**: Discuss files and tasks with your team

## 🚀 Getting Started

### Prerequisites
- Node.js 16.14+ and npm 8.3+
- Supabase account (https://supabase.com/)
- Google Cloud Project (for Google Sheets integration, optional)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/cvs-cms.git
   cd cvs-cms
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   
   # Google Sheets (optional)
   GOOGLE_SHEETS_ID=your-google-sheet-id
   GOOGLE_SERVICE_ACCOUNT_CREDS=your-google-service-account-json
   
   # App Configuration
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-nextauth-secret
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Project Structure

```
cvs-cms/
├── components/         # Reusable React components
│   ├── Notifications/  # Notification system components
│   ├── Project/        # Project-specific components
│   └── UI/             # Generic UI components
├── lib/                # Utility libraries and helpers
│   ├── supabase.ts     # Supabase client configuration
│   └── utils.ts        # Common utility functions
├── pages/              # Next.js pages and API routes
│   ├── api/            # API endpoints
│   └── project/        # Project-related pages
├── public/             # Static assets
└── styles/             # Global styles and themes
```

## 🔔 Notification System

### Features
- **Real-time Updates**: Instant notification delivery using Supabase Realtime
- **Unread Indicators**: Clear visual indicators for unread notifications
- **Smart Filtering**: Only shows relevant, unread notifications
- **Event-based Alerts**: Get notified about upcoming events and deadlines
- **Actionable Items**: Click notifications to jump directly to the relevant content

### Notification Types
1. **File Uploads**: Get notified when new files are uploaded to your projects
2. **Event Reminders**: Stay on top of upcoming events and deadlines
3. **Mentions**: Get notified when someone mentions you in comments or chats
4. **Task Updates**: Stay informed about task assignments and status changes

## 📅 Event Management

- **Calendar Integration**: View all events in a monthly, weekly, or daily view
- **Event Notifications**: Get reminders for upcoming events
- **RSVP & Attendance**: Track event participation
- **Recurring Events**: Support for repeating events with custom schedules

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Environment Variables

See `.env.example` for all required environment variables.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Next.js and Supabase
- Icons from [React Icons](https://react-icons.github.io/react-icons/)
- Calendar powered by FullCalendar

---

*Last Updated: May 18, 2025*
