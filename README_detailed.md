#  Formula One Web App – ESM FullStack Challenge

This project is a response to the ESM FullStack coding challenge. The original app allowed users to view Formula One data but lacked interactivity. I enhanced the project to support full CRUD operations, visual insights, tabbed views, and authentication to make it more production-ready and user-friendly.

---

##  Task 1: Drivers – Full CRUD

### What was asked:
Upgrade the Drivers section to allow users to add, edit, and remove drivers via the frontend and backend.

### My approach:
- I added `POST`, `PUT`, and `DELETE` endpoints in `routers/drivers.py`, using FastAPI with proper exception handling and database commits.
- In `drivers.tsx`, I built out `DriverCreate`, `DriverEdit`, and `DriverShow` using React-Admin.
- I used custom toolbars and notification messages to handle success and error feedback.
- Form validation ensures required fields like name, date of birth, and nationality are always provided.
- Deletion uses a confirm dialog to prevent accidental removals.

---

## Task 2: Races – Tabbed View

### What was asked:
Make the Race details view more informative by showing circuits, drivers, and constructors related to each race.

### My approach:
- In `routers/races.py`, I created new endpoints like `/races/{id}/circuit`, `/races/{id}/drivers`, and `/races/{id}/constructors`.
- These endpoints use joins on race ID to return related entities from the database.
- On the frontend, I refactored `races.tsx` to use `TabbedShowLayout`, creating tabs for:
  - Race summary
  - Circuit details (fetched and shown inline)
  - Drivers list (in a datagrid)
  - Constructors list (in a datagrid)
- This UI feels more structured and familiar to users navigating large datasets.

---

##  Task 3: Dashboard – Visual Insights

###  What was asked:
Add a dashboard with two or more charts that provide useful insights.

###  My approach:
- I created summary endpoints in `routers/dashboard.py` to:
  - Count races by year
  - Aggregate driver nationalities
- In `dashboard.tsx`, I used basic React chart libraries to render:
  - A bar chart of race count per season
  - A pie chart showing driver nationality breakdown
- The charts are responsive and help stakeholders visually understand trends in the data.

---

##  Task 4: Authentication System

###  What was asked:
Replace the static JSON login with a working authentication flow.

###  My approach:
- I rewrote `authProvider.ts` to simulate real login/logout behavior.
- Users log in with credentials stored in localStorage, with `checkAuth`, `logout`, and `getPermissions` all implemented.
- If credentials are incorrect or session is missing, users are redirected to the login page.
- This makes the app feel more secure and complete without overengineering a backend login.

---

##  Task 5: Custom Improvements

###  Extra things I implemented:
- Added tooltips and helper texts to driver forms to guide users (e.g., format for DOB, max length for codes).
- Enhanced error handling: backend validation errors show friendly messages in the UI.
- Used MUI Box/Grid components to make forms mobile-responsive.
- Delete actions all use confirmation to avoid data loss.

---

## How to Run

### Docker (preferred):
```bash
make run
```

### Locally:
```bash
make api  # Start FastAPI backend
make ui   # Start React frontend
```

---

## 📁 Key Files Modified

- `routers/drivers.py` — Full CRUD API for drivers
- `routers/races.py` — Tab data for race detail page
- `routers/dashboard.py` — Summary stats for charts
- `pages/drivers.tsx` — Create/Edit/Delete UI
- `pages/races.tsx` — Tabbed race view
- `pages/dashboard.tsx` — Visual dashboard
- `authProvider.ts` — Login/logout simulation

---

## My Thoughts

This project demonstrates practical full-stack capability:
- REST API design
- Declarative admin UI with validation
- Real-world UX patterns
- Modular, maintainable code
- Role-Based Access Control 
    Admin: Full system access, can manage all users
    User: Standard access, read-only user management
    Viewer: Limited access, read-only user management 

It’s now flexible enough to onboard real users, explore deeper insights, and evolve into a production-grade tool.