# Dark Table Message

A minimalist, high-performance multi-platform messaging and bulk-mailing client inspired by the `zed.dev` design language. Built for speed, precision, and technical users.

![Design Aesthetic](https://img.shields.io/badge/Design-Zed.dev-blue)
![Platforms](https://img.shields.io/badge/Platforms-Gmail%20%7C%20WhatsApp-green)
![Theme](https://img.shields.io/badge/Theme-Pure%20Black%20%2F%20Off--white%20%2F%20One%20Dark-black)

## Key Features

### 1. Dual-Platform Integration
- **Gmail (GAS)**: Professional email composing and bulk mailing using Google Apps Script as a secure backend.
- **WhatsApp (wa.me)**: Seamless message generation for WhatsApp.
    - Generate `wa.me` links for single or bulk recipients.
    - **WhatsApp Queue**: Manage and edit your generated messages in a dedicated side panel before sending.
    - **Smart Formatting**: Dedicated toolbar for WhatsApp markup (`*bold*`, `_italic_`, `~strike~`, etc.).
    - **Automatic CC**: Auto-prepends default country codes to local numbers.

### 2. Professional Editors
- **Rich Text (Gmail)**: Visual editing with advanced formatting (Bold, Italic, Lists, Colors, Spacing, Block Quotes, Inline Code, Monospace).
- **Source Mode (Gmail)**: Direct HTML editing with live synchronization.
- **Markup Editor (WhatsApp)**: Plain-text editor with a specialized toolbar for WhatsApp formatting symbols.

### 3. Advanced Bulk Messaging
- **Flexible Data Source**: Support for **CSV**, **XLSX**, and **XLS** files via drag-and-drop.
- **Smart Variable Mapping**: Automatically detects `{variable}` placeholders in message templates and maps them to spreadsheet columns.
- **Mailing Strategies**: 
    - **Auto**: Process the entire list.
    - **Range**: Specify an exact start/end record.
    - **Selective**: Manually pick records from a searchable list.

### 4. Integrated Live Preview
- **Real-time Rendering**: See exactly how your message looks before sending.
- **Platform-Specific Preview**: Gmail preview renders full HTML; WhatsApp preview renders markup symbols as visual styles (Bold, Italic, etc.).
- **Resizable Side Panel**: Drag to adjust your workspace.

### 5. Deep Customization & UX
- **Dynamic Themes**: OLED Pure Black, Off-white, One Dark, and GitHub Light.
- **Responsive Design**: Fully optimized for mobile with a hamburger menu and slide-out panels.
- **Proportional Scaling**: Global UI Size slider to scale the entire application interface.
- **Technical Aesthetic**: Clean, distraction-free UI with technical font options (Inter, JetBrains Mono, etc.).

---

## Tech Stack
- **Frontend**: React (TypeScript) + Vite
- **Styling**: Vanilla CSS (Relative `em` scaling & CSS Variables)
- **Parsing**: PapaParse (CSV) & SheetJS (XLSX)
- **AI-Assisted Development**: Built and maintained with **Gemini CLI** for surgical updates and rapid feature implementation.

---

## Getting Started

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/muhammadabdullah007git/dark_table_mail

# Install dependencies
npm install

# Start development server
npm run dev
```

### 2. Backend Setup (For Gmail)
Click the **`?` icon** in the sidebar to copy the Google Apps Script code and follow the step-by-step deployment guide.

### 3. WhatsApp Setup
1. Click the **Gear Icon** in the sidebar.
2. Enter your **Default Country Code** (e.g., `92` or `1`).
3. Compose your message using `{variable}` placeholders if using bulk data.
4. Click **Generate** to populate your WhatsApp Queue.

---

## Security and Privacy
- **Local-Only Processing**: Your data (CSVs, Excel files, messages) is processed entirely in your browser. 
- **Direct Backend**: No middle-man servers. Data goes directly from your browser to Google (for Gmail) or generates local links (for WhatsApp).
- **No Tracking**: Zero third-party analytics or tracking scripts.

## Deployment

### Deploy to Render
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/muhammadabdullah007git/dark_table_mail)

## License
MIT
