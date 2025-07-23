import { AuthProvider } from 'react-admin';

// Simple static authentication provider
const authProvider: AuthProvider = {
    // Called when the user attempts to log in
    login: ({ username, password }) => {
        console.log('Login attempt:', { username, password });
        
        // Static credentials - you can modify these
        const validCredentials = [
            { username: 'admin', password: 'admin' },
            { username: 'user', password: 'user123' },
            { username: 'test', password: 'test' },
            // Add the credentials you tried
            { username: 'user', password: 'user123' }
        ];
        
        const isValid = validCredentials.some(
            cred => cred.username === username && cred.password === password
        );
        
        if (isValid) {
            // Store user info in localStorage
            localStorage.setItem('auth', JSON.stringify({ 
                username, 
                token: 'fake-jwt-token',
                role: 'admin'
            }));
            return Promise.resolve();
        }
        
        // Return a rejected promise with error message
        return Promise.reject(new Error('Invalid username or password'));
    },

    // Called when the user clicks on the logout button
    logout: () => {
        localStorage.removeItem('auth');
        return Promise.resolve();
    },

    // Called when the API returns an error
    checkError: ({ status }: { status: number }) => {
        if (status === 401 || status === 403) {
            localStorage.removeItem('auth');
            return Promise.reject();
        }
        return Promise.resolve();
    },

    // Called when the user navigates to a new location, to check for authentication
    checkAuth: () => {
        const auth = localStorage.getItem('auth');
        return auth ? Promise.resolve() : Promise.reject();
    },

    // Called when the user navigates to a new location, to check for permissions / roles
    getPermissions: () => {
        const auth = localStorage.getItem('auth');
        if (auth) {
            const user = JSON.parse(auth);
            return Promise.resolve(user.role);
        }
        return Promise.reject();
    },

    // Optional: Get user identity
    getIdentity: () => {
        const auth = localStorage.getItem('auth');
        if (auth) {
            const user = JSON.parse(auth);
            return Promise.resolve({
                id: user.username,
                fullName: user.username.charAt(0).toUpperCase() + user.username.slice(1),
                avatar: undefined,
            });
        }
        return Promise.reject();
    },
};

export default authProvider;