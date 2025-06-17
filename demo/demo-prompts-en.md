# Demo Prompts for Prompt Line (English)

## AI Coding Assistant Prompts

### 1. Simple Feature Request
```
Add a dark mode toggle to the settings page. Use the existing theme context and add a switch component in the header.
```

### 2. Bug Fix Request
```
Fix the authentication issue where users are logged out after refreshing the page. Check if the JWT token is properly stored in localStorage and implement proper token validation on app initialization.
```

### 3. Refactoring Request
```
Refactor the UserProfile component to use custom hooks for data fetching. Extract the API logic into a useUserProfile hook and implement proper error handling with loading states.
```

### 4. Complex Implementation Request
```
Implement a real-time collaborative text editor using WebSockets. Requirements:
- Multiple users can edit simultaneously
- Show user cursors and selections
- Add conflict resolution for concurrent edits
- Include a user presence indicator
- Use Socket.IO for WebSocket connection
```

### 5. Code Review Request
```
Review the pull request #234 and provide feedback on:
- Code quality and best practices
- Performance implications
- Security concerns
- Test coverage
Suggest improvements where necessary.
```

### 6. Documentation Request
```
Generate comprehensive API documentation for the REST endpoints in /api/v2/. Include:
- Endpoint descriptions
- Request/response examples
- Authentication requirements
- Error codes and handling
```

### 7. Testing Request
```
Write unit tests for the ShoppingCart component. Cover:
- Adding/removing items
- Quantity updates
- Price calculations
- Empty cart state
- Error scenarios
Use Jest and React Testing Library.
```

### 8. Performance Optimization
```
Analyze and optimize the product listing page performance. Focus on:
- Lazy loading images
- Implementing virtual scrolling for long lists
- Memoizing expensive calculations
- Reducing unnecessary re-renders
```

### 9. Database Query Optimization
```
The user dashboard is loading slowly. Analyze the SQL queries and optimize them. Consider adding proper indexes, query restructuring, and implementing caching where appropriate.
```

### 10. Architecture Design
```
Design a microservices architecture for our e-commerce platform. Include:
- Service boundaries and responsibilities
- Communication patterns (REST/gRPC/Message Queue)
- Data consistency strategies
- Deployment considerations
Create a high-level diagram and implementation plan.
```

## General Development Prompts

### 11. Git Operations
```
Create a new feature branch for the payment integration, commit the changes with proper commit messages following conventional commits, and create a pull request with a detailed description.
```

### 12. Environment Setup
```
Set up a development environment for the React Native mobile app. Install all dependencies, configure the iOS simulator, and ensure hot reloading works properly.
```

### 13. Debugging Request
```
Debug why the webhook endpoint is returning 500 errors intermittently. Check the logs, add detailed error logging, and identify the root cause.
```

### 14. Security Audit
```
Perform a security audit on the authentication flow. Check for:
- SQL injection vulnerabilities
- XSS possibilities
- CSRF protection
- Secure password handling
- JWT token security
```

### 15. Multi-line Complex Request
```
I need to implement a complete user management system with the following features:

1. User Registration and Login
   - Email/password authentication
   - OAuth integration (Google, GitHub)
   - Email verification
   - Password reset functionality

2. User Profiles
   - Profile picture upload
   - Editable user information
   - Privacy settings
   
3. Role-Based Access Control
   - Admin, moderator, and user roles
   - Permission management
   - Role assignment UI
   
4. User Activity Tracking
   - Login history
   - Action logs
   - Analytics dashboard

Please implement this with proper error handling, validation, and comprehensive tests. Use TypeScript and follow our existing coding standards.
```