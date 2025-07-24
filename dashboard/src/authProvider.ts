import { AuthProvider } from 'react-admin';
import { API_BASE_URL } from './utils/common';

// Enhanced authentication provider with database integration
const authProvider: AuthProvider = {
    // Called when the user attempts to log in
    login: async ({ username, password }) => {
        console.log('Login attempt:', { username });
        
        try {
            // Call the /auth/login endpoint (matches the router registration)
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                
                // Store user data and token from API response
                const authData = {
                    username: data.user.username,
                    fullName: data.user.full_name,
                    email: data.user.email,
                    role: data.user.role,
                    token: data.access_token, // Use the actual JWT token
                    loginTime: new Date().toISOString()
                };
                
                localStorage.setItem('auth', JSON.stringify(authData));
                console.log('API login successful for:', username);
                return Promise.resolve();
            }
            
            // If API login fails, get the error response
            const errorData = await response.json();
            console.log('API login failed:', errorData);
            throw new Error(errorData.detail || 'Login failed');
            
        } catch (apiError: any) {
            console.log('API login failed, trying static fallback:', apiError.message);
            
            // Fallback to static credentials if API fails
            const staticCredentials = [
                { username: 'admin', password: 'admin', role: 'admin', fullName: 'Administrator' },
                { username: 'user', password: 'user123', role: 'user', fullName: 'Standard User' },
                { username: 'test', password: 'test', role: 'viewer', fullName: 'Test User' },
            ];
            
            const staticUser = staticCredentials.find(
                cred => cred.username === username && cred.password === password
            );
            
            if (staticUser) {
                const authData = {
                    username: staticUser.username,
                    fullName: staticUser.fullName,
                    role: staticUser.role,
                    token: 'static-jwt-token-' + Date.now(),
                    loginTime: new Date().toISOString()
                };
                
                localStorage.setItem('auth', JSON.stringify(authData));
                console.log('Static login successful for:', username);
                return Promise.resolve();
            }
            
            // If both API and static fail, return the API error or a generic one
            const errorMessage = apiError.message || 'Invalid username or password';
            console.log('Login failed completely:', errorMessage);
            return Promise.reject(new Error(errorMessage));
        }
    },

    // Called when the user clicks on the logout button
    logout: () => {
        console.log('User logging out');
        localStorage.removeItem('auth');
        return Promise.resolve();
    },

    // Called when the API returns an error
    checkError: ({ status }: { status: number }) => {
        console.log('Checking error status:', status);
        if (status === 401 || status === 403) {
            console.log('Authentication error - clearing auth data');
            localStorage.removeItem('auth');
            return Promise.reject(new Error('Authentication required'));
        }
        return Promise.resolve();
    },

    // Called when the user navigates to a new location, to check for authentication
    checkAuth: () => {
        const auth = localStorage.getItem('auth');
        if (auth) {
            try {
                const authData = JSON.parse(auth);
                if (authData.token) {
                    return Promise.resolve();
                }
            } catch (e) {
                console.error('Invalid auth data:', e);
                localStorage.removeItem('auth');
            }
        }
        return Promise.reject(new Error('Not authenticated'));
    },

    // Called when the user navigates to a new location, to check for permissions / roles
    getPermissions: () => {
        const auth = localStorage.getItem('auth');
        if (auth) {
            try {
                const user = JSON.parse(auth);
                console.log('User permissions:', user.role);
                return Promise.resolve(user.role);
            } catch (e) {
                console.error('Error getting permissions:', e);
            }
        }
        return Promise.reject(new Error('No permissions available'));
    },

    // Get user identity for display
    getIdentity: () => {
        const auth = localStorage.getItem('auth');
        if (auth) {
            try {
                const user = JSON.parse(auth);
                return Promise.resolve({
                    id: user.username,
                    fullName: user.fullName || user.username,
                    avatar: undefined,
                });
            } catch (e) {
                console.error('Error getting identity:', e);
            }
        }
        return Promise.reject(new Error('No user identity available'));
    },
};

export default authProvider;