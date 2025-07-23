import simpleRestProvider from "ra-data-simple-rest";
import { fetchUtils } from 'react-admin';
import { API_BASE_URL } from "./utils/common";

// Custom HTTP client that adds authentication headers
const httpClient = (url: string, options: any = {}) => {
  if (!options.headers) {
    options.headers = new Headers({ Accept: 'application/json' });
  }
  
  // Add JWT token to all API requests
  const token = localStorage.getItem('token');
  if (token) {
    options.headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetchUtils.fetchJson(url, options);
};

// Export the data provider with auth support
export const dataProvider = simpleRestProvider(API_BASE_URL, httpClient);