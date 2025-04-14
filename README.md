# Biddit2

A course planning and exploration tool for students at the University of St. Gallen.

## 📋 Description

Biddit2 helps University of St. Gallen students browse available courses and plan for upcoming bidding rounds. It provides a comprehensive course discovery interface to make informed bidding decisions.

## ✨ Features

- **Course Discovery**: Browse and search through available courses
- **Semester Planning**: Plan your course selections before bidding rounds
- **Course Information**: Access detailed information about courses
- **Secure Authentication**: Login via Microsoft Entra ID

## 🚀 Getting Started

### Prerequisites

- Node.js (v22.8.0)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/studentenschaft/Biddit2.git
   ```

2. Navigate to the project app directory:

   ```bash
   cd app
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

### Testing

To ensure no changes break any existing features, run the testing suite with the following command:

```bash
npm test
```

## 🛠️ Technology Stack

- **Frontend**: React with Vite
- **Styling**: Tailwind CSS
- **Authentication**: Microsoft Entra ID
- **State Management**: Recoil

## 📁 Project Structure

```txt
Biddit2/
├── docs/                  # Documentation
│   └── auth/              # Authentication documentation
│   └── architecture/      # System architecture diagrams
├── app/                   # App source files
│   ├── public/            # Static assets
│   │   └── favicon.ico    # Site favicon
│   └── src/               # Application source code
│       ├── assets/        # Images and resources
│       │   └── ...        # SHSG logo files
│       ├── components/    # Reusable React components
│       │   └── auth/      # Authentication components
│       ├── pages/         # Page components
│       ├── App.jsx        # Main application component
│       ├── index.css      # Global styles
│       ├── index.js       # Entry file
│       └── main.jsx       # Main render file
├── .gitignore             # Git ignore file
├── package.json           # Project dependencies
├── postcss.config.js      # PostCSS configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── vite.config.js         # Vite configuration
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
If you have any ideas or features you would like to see, please open an issue.
University projects are welcome as well! Just reach out and we can discuss potential collaborations for your course work.

## Important Note

This repository only contains the frontend code for Biddit2. The backend code is located in a separate repository which will be private for security reasons. The backend is hosted on a private server and is not publicly accessible. The frontend communicates with the backend via API calls to fetch and send data.
For API documentation, see the [University of St. Gallen Event API](https://integration.unisg.ch/eventapi/swagger/index.html).
If you are interested in the backend code, please contact us directly.

## 📝 License

_This project is licensed under CC BY-NC-SA 4.0 - see the [LICENSE](LICENSE) file for details._

## 👥 Contact

Studentenschaft der Universität St. Gallen (SHSG)
[https://www.shsg.ch](https://www.shsg.ch)
