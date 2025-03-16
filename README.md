<!--
Changes made:
2025-03-16: Created initial README with project overview, features, setup instructions, and technical details
-->

# WordPress Database AI Query Assistant 🤖

A powerful tool that helps you explore and query your WordPress database using natural language. Simply ask questions in plain English, and let the AI generate optimized SQL queries for you. Built with Express, TypeScript, Vue.js, and Google's Gemini AI.

![MySQL AI Query Assistant](public/wp-ai-query.png)

## ✨ Features

- **Natural Language Queries**: Convert plain English questions into optimized SQL queries
- **Schema Visualization**: View your database structure in a clean, organized format
- **Smart Query Generation**: AI-powered SQL generation with safety checks
- **Dual Connection Methods**: Support for both standard connection parameters and connection strings
- **Safety First**: Built-in protection against unsafe operations (UPDATE/DELETE)
- **Modern UI**: Clean, responsive interface with loading states and error handling
- **Real-time Results**: Instant query execution and result display

## 🚀 Getting Started

### Prerequisites

- Node.js >= 14
- MySQL database
- Google Gemini API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mysql-ai-query-assistant.git
cd mysql-ai-query-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=your_database

# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key

# Security
ALLOW_UNSAFE_QUERIES=false
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## 💡 Usage

1. **Connect to Database**:
   - Standard connection: Enter host, port, user, password, and database
   - Connection string: Paste your MySQL connection URL
   - Real-time validation and error feedback

2. **View Schema**:
   - Clean, organized display of database structure
   - Tables with columns, types, and key information
   - Beautiful UI with proper spacing and typography

3. **Generate Queries**:
   - Ask questions in natural language
   - AI generates optimized SQL with explanations
   - Review query safety and potential impacts
   - See results in a well-formatted table

4. **Safety Features**:
   - Protection against UPDATE/DELETE operations
   - Clear warnings for data-modifying queries
   - Environment-based safety controls
   - Input validation and error handling

## 🛠️ Technical Details

### Design Principles
- Code readability over premature optimization
- Component-based architecture (max 300 lines per component)
- Single responsibility functions (max 20 lines)
- Type safety with TypeScript throughout

### Backend
- Express.js with TypeScript
- MySQL2 with connection pooling
- Gemini AI for natural language processing
- Structured error handling with specific codes

### Frontend
- Vue.js 3 (preferred over React)
- Tailwind CSS for styling
- Lucide Icons for static icons
- Potlab Icons for animations (https://www.potlabicons.com/)

### Code Quality Standards
- Type hints mandatory
- No unnecessary comments or docstrings
- Keep TODO comments
- Merge comments with same date
- File headers track changes with dates
- Refactor unused code, never delete used functions
- Test for readability first, performance second

## 🔒 Security

- Connection credentials are never stored
- Unsafe operations are blocked by default
- Input validation and SQL injection prevention
- Environment-based configuration

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini AI for natural language processing
- The Vue.js team for the amazing framework
- The Tailwind CSS team for the utility-first CSS framework
- The MySQL team for the robust database system
