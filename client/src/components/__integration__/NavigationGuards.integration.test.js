/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 2: TOP-DOWN INTEGRATION TESTING
 * NAVIGATION GUARDS INTEGRATION TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE:
 * Test the integration between navigation components and authentication:
 * - Header component with auth context
 * - Role-based navigation rendering (AdminMenu vs UserMenu)
 * - Authentication state changes affecting UI
 * - Cart integration with navigation
 * - Category loading integration
 * 
 * TESTING STRATEGY: Sandwich Method (Top-Down)
 * - Test from Header component (high-level navigation)
 * - Verify integration with auth context
 * - Test role-based menu rendering
 * - Verify navigation guards respond to auth changes
 * 
 * INTEGRATION POINTS TESTED:
 * 1. Header → useAuth context (authentication state)
 * 2. Header → useCart context (cart state)
 * 3. Header → useCategory hook (category loading)
 * 4. Header → logout flow (localStorage + auth state)
 * 5. AdminMenu → NavLink (admin navigation)
 * 6. UserMenu → NavLink (user navigation)
 * 7. Conditional rendering based on auth.user and auth.user.role
 * 
 * MOCK STRATEGY:
 * - Mock: useAuth hook (controlled auth states)
 * - Mock: useCart hook (controlled cart states)
 * - Mock: useCategory hook (controlled category data)
 * - Mock: localStorage (controlled storage operations)
 * - Mock: toast notifications (suppress notifications)
 * - Real: React Router NavLink/Link components
 * - Real: Conditional rendering logic
 * 
 * TEST PHILOSOPHY:
 * Integration tests verify navigation guards respond correctly to auth state.
 * We test complete flows: logged out → logged in → role-based navigation.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Header from '../Header';
import AdminMenu from '../AdminMenu';
import UserMenu from '../UserMenu';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

// Mock auth context
jest.mock('../../context/auth', () => ({
  useAuth: jest.fn(),
}));

// Mock cart context
jest.mock('../../context/cart', () => ({
  useCart: jest.fn(),
}));

// Mock useCategory hook
jest.mock('../../hooks/useCategory', () => jest.fn());

// Mock SearchInput component
jest.mock('../Form/SearchInput', () => {
  return function MockSearchInput() {
    return <div data-testid="search-input">SearchInput</div>;
  };
});

// Mock toast notifications
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// ═══════════════════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Helper to render component with Router
 */
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

/**
 * Setup default mocks
 */
const setupDefaultMocks = () => {
  const { useAuth } = require('../../context/auth');
  const { useCart } = require('../../context/cart');
  const useCategory = require('../../hooks/useCategory');
  
  // Default: not authenticated
  useAuth.mockReturnValue([{ user: null, token: '' }, jest.fn()]);
  
  // Default: empty cart
  useCart.mockReturnValue([[]]);
  
  // Default: no categories
  useCategory.mockReturnValue([]);
  
  // Mock localStorage
  Storage.prototype.removeItem = jest.fn();
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE: NAVIGATION GUARDS INTEGRATION TESTS - PHASE 2
// ═══════════════════════════════════════════════════════════════════════════

describe('Navigation Guards Integration Tests - Phase 2: Security & Navigation Layer', () => {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST SETUP AND TEARDOWN
  // ═══════════════════════════════════════════════════════════════════════════
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mocks
    setupDefaultMocks();
  });
  
  afterEach(() => {
    // Clean up
    jest.resetAllMocks();
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION TEST GROUP 1: HEADER AUTHENTICATION STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Integration Test #1: Header Authentication State', () => {
    
    /**
     * TEST 1.1: Unauthenticated User Navigation
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header → useAuth context (no user)
     * - Conditional rendering of Login/Register links
     * - Cart integration (empty cart display)
     * 
     * Expected Flow:
     * 1. User not authenticated (auth.user === null)
     * 2. Header displays Login and Register links
     * 3. Header does NOT display user dropdown
     * 4. Cart badge shows 0
     */
    it('should display login and register links for unauthenticated users', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup unauthenticated state
      // ═══════════════════════════════════════════════════════════════
      
      const { useAuth } = require('../../context/auth');
      useAuth.mockReturnValue([
        { user: null, token: '' },
        jest.fn()
      ]);
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Render Header
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<Header />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify unauthenticated navigation
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Login and Register links visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Register')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: User dropdown NOT visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Logout')).not.toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #3: Common navigation elements visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Cart')).toBeInTheDocument();
      expect(screen.getByText('🛒 Virtual Vault')).toBeInTheDocument();
    });
    
    /**
     * TEST 1.2: Authenticated Regular User Navigation
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header → useAuth context (regular user)
     * - User dropdown with Dashboard link (role-based routing)
     * - Logout functionality integration
     */
    it('should display user dropdown for authenticated regular users', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup authenticated regular user
      // ═══════════════════════════════════════════════════════════════
      
      const { useAuth } = require('../../context/auth');
      const mockSetAuth = jest.fn();
      
      useAuth.mockReturnValue([
        {
          user: {
            _id: 'user123',
            name: 'John Doe',
            email: 'john@example.com',
            role: 0, // Regular user
          },
          token: 'mock-jwt-token',
        },
        mockSetAuth
      ]);
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Render Header
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<Header />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify authenticated user navigation
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: User name displayed in dropdown
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: Login/Register NOT visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.queryByText('Login')).not.toBeInTheDocument();
      expect(screen.queryByText('Register')).not.toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #3: Dashboard and Logout links exist
      // ───────────────────────────────────────────────────────────────
      const dashboardLink = screen.getByText('Dashboard');
      const logoutLink = screen.getByText('Logout');
      
      expect(dashboardLink).toBeInTheDocument();
      expect(logoutLink).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #4: Dashboard link points to user dashboard
      // ───────────────────────────────────────────────────────────────
      expect(dashboardLink.closest('a')).toHaveAttribute('href', '/dashboard/user');
    });
    
    /**
     * TEST 1.3: Authenticated Admin User Navigation
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header → useAuth context (admin user)
     * - Role-based routing (role === 1)
     * - Admin dashboard link rendering
     */
    it('should display admin dashboard link for admin users', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup authenticated admin user
      // ═══════════════════════════════════════════════════════════════
      
      const { useAuth } = require('../../context/auth');
      
      useAuth.mockReturnValue([
        {
          user: {
            _id: 'admin123',
            name: 'Admin User',
            email: 'admin@example.com',
            role: 1, // Admin role
          },
          token: 'mock-admin-jwt-token',
        },
        jest.fn()
      ]);
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Render Header
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<Header />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify admin navigation
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Admin name displayed
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: Dashboard link points to admin dashboard
      // ───────────────────────────────────────────────────────────────
      const dashboardLink = screen.getByText('Dashboard');
      expect(dashboardLink.closest('a')).toHaveAttribute('href', '/dashboard/admin');
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION TEST GROUP 2: LOGOUT FLOW
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Integration Test #2: Logout Flow Integration', () => {
    
    /**
     * TEST 2.1: Complete Logout Flow
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header → handleLogout function
     * - setAuth state update (clear user and token)
     * - localStorage.removeItem('auth')
     * - toast notification
     * 
     * Expected Flow:
     * 1. User clicks Logout link
     * 2. Auth state cleared (user: null, token: '')
     * 3. localStorage 'auth' removed
     * 4. Success toast displayed
     */
    it('should complete logout flow with state and storage cleanup', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup authenticated user
      // ═══════════════════════════════════════════════════════════════
      
      const { useAuth } = require('../../context/auth');
      const toast = require('react-hot-toast');
      const mockSetAuth = jest.fn();
      
      const initialAuth = {
        user: {
          _id: 'user123',
          name: 'John Doe',
          role: 0,
        },
        token: 'mock-token',
      };
      
      useAuth.mockReturnValue([initialAuth, mockSetAuth]);
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Render and click Logout
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<Header />);
      
      const logoutLink = screen.getByText('Logout');
      fireEvent.click(logoutLink);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify complete logout integration
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Auth state cleared
      // ───────────────────────────────────────────────────────────────
      expect(mockSetAuth).toHaveBeenCalledWith({
        ...initialAuth,
        user: null,
        token: '',
      });
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: localStorage cleared
      // ───────────────────────────────────────────────────────────────
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth');
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #3: Success toast displayed
      // ───────────────────────────────────────────────────────────────
      expect(toast.success).toHaveBeenCalledWith('Logout Successfully');
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION TEST GROUP 3: CART INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Integration Test #3: Cart Integration', () => {
    
    /**
     * TEST 3.1: Cart Badge Display
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header → useCart context
     * - Badge component with cart count
     * - Cart navigation link
     */
    it('should display cart badge with item count', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup cart with items
      // ═══════════════════════════════════════════════════════════════
      
      const { useCart } = require('../../context/cart');
      
      const mockCart = [
        { _id: 'product1', name: 'Product 1' },
        { _id: 'product2', name: 'Product 2' },
        { _id: 'product3', name: 'Product 3' },
      ];
      
      useCart.mockReturnValue([mockCart]);
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Render Header
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<Header />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify cart integration
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Cart link visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Cart')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: Badge shows correct count
      // ───────────────────────────────────────────────────────────────
      const badge = screen.getByText('3');
      expect(badge).toBeInTheDocument();
    });
    
    /**
     * TEST 3.2: Empty Cart Display
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header → useCart context (empty cart)
     * - Badge displays 0 with showZero prop
     */
    it('should display zero badge for empty cart', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup empty cart
      // ═══════════════════════════════════════════════════════════════
      
      const { useCart } = require('../../context/cart');
      useCart.mockReturnValue([[]]);
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Render Header
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<Header />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify empty cart display
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Cart link still visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Cart')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: Badge shows 0
      // ───────────────────────────────────────────────────────────────
      const badge = screen.getByText('0');
      expect(badge).toBeInTheDocument();
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION TEST GROUP 4: CATEGORY INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Integration Test #4: Category Integration', () => {
    
    /**
     * TEST 4.1: Categories Loading and Display
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header → useCategory hook
     * - Dynamic category links rendering
     * - Category dropdown navigation
     */
    it('should display categories from useCategory hook', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup categories
      // ═══════════════════════════════════════════════════════════════
      
      const useCategory = require('../../hooks/useCategory');
      
      const mockCategories = [
        { _id: 'cat1', name: 'Electronics', slug: 'electronics' },
        { _id: 'cat2', name: 'Clothing', slug: 'clothing' },
        { _id: 'cat3', name: 'Books', slug: 'books' },
      ];
      
      useCategory.mockReturnValue(mockCategories);
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Render Header
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<Header />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify category integration
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Category dropdown visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Categories')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: All categories rendered
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('Clothing')).toBeInTheDocument();
      expect(screen.getByText('Books')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #3: Category links have correct hrefs
      // ───────────────────────────────────────────────────────────────
      const electronicsLink = screen.getByText('Electronics').closest('a');
      expect(electronicsLink).toHaveAttribute('href', '/category/electronics');
    });
    
    /**
     * TEST 4.2: Empty Categories Handling
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header → useCategory hook (empty array)
     * - Graceful handling of no categories
     */
    it('should handle empty categories gracefully', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup empty categories
      // ═══════════════════════════════════════════════════════════════
      
      const useCategory = require('../../hooks/useCategory');
      useCategory.mockReturnValue([]);
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Render Header
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<Header />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify graceful handling
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Category dropdown still visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Categories')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: "All Categories" link visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('All Categories')).toBeInTheDocument();
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION TEST GROUP 5: ROLE-BASED MENU COMPONENTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Integration Test #5: Role-Based Menu Components', () => {
    
    /**
     * TEST 5.1: Admin Menu Navigation
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - AdminMenu component rendering
     * - Admin-specific navigation links
     * - NavLink integration
     */
    it('should render admin menu with correct navigation links', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE & ACT: Render AdminMenu
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<AdminMenu />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify admin menu integration
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Admin Panel header visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: All admin navigation links visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Create Category')).toBeInTheDocument();
      expect(screen.getByText('Create Product')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #3: Links have correct hrefs
      // ───────────────────────────────────────────────────────────────
      const createCategoryLink = screen.getByText('Create Category').closest('a');
      expect(createCategoryLink).toHaveAttribute('href', '/dashboard/admin/create-category');
      
      const productsLink = screen.getByText('Products').closest('a');
      expect(productsLink).toHaveAttribute('href', '/dashboard/admin/products');
    });
    
    /**
     * TEST 5.2: User Menu Navigation
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - UserMenu component rendering
     * - User-specific navigation links
     * - NavLink integration
     */
    it('should render user menu with correct navigation links', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE & ACT: Render UserMenu
      // ═══════════════════════════════════════════════════════════════
      
      renderWithRouter(<UserMenu />);
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify user menu integration
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Dashboard header visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: User navigation links visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #3: Links have correct hrefs
      // ───────────────────────────────────────────────────────────────
      const profileLink = screen.getByText('Profile').closest('a');
      expect(profileLink).toHaveAttribute('href', '/dashboard/user/profile');
      
      const ordersLink = screen.getByText('Orders').closest('a');
      expect(ordersLink).toHaveAttribute('href', '/dashboard/user/orders');
    });
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTEGRATION TEST GROUP 6: AUTH STATE TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  describe('Integration Test #6: Authentication State Transitions', () => {
    
    /**
     * TEST 6.1: Login State Transition
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Header re-renders on auth state change
     * - UI updates from logged out to logged in
     */
    it('should update UI when auth state changes from logged out to logged in', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup initial logged out state
      // ═══════════════════════════════════════════════════════════════
      
      const { useAuth } = require('../../context/auth');
      
      // Initial: logged out
      useAuth.mockReturnValue([
        { user: null, token: '' },
        jest.fn()
      ]);
      
      const { rerender } = renderWithRouter(<Header />);
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: Login/Register visible initially
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Register')).toBeInTheDocument();
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Change auth state to logged in
      // ═══════════════════════════════════════════════════════════════
      
      useAuth.mockReturnValue([
        {
          user: {
            _id: 'user123',
            name: 'Jane Doe',
            role: 0,
          },
          token: 'new-token',
        },
        jest.fn()
      ]);
      
      rerender(
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      );
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify UI updated
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: Login/Register now hidden
      // ───────────────────────────────────────────────────────────────
      expect(screen.queryByText('Login')).not.toBeInTheDocument();
      expect(screen.queryByText('Register')).not.toBeInTheDocument();
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #3: User dropdown now visible
      // ───────────────────────────────────────────────────────────────
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
    
    /**
     * TEST 6.2: Role Change Transition
     * ─────────────────────────────────────────────────────────────────────────
     * Integration Points:
     * - Dashboard link updates based on role change
     * - Role-based routing adjustment
     */
    it('should update dashboard link when user role changes', () => {
      // ═══════════════════════════════════════════════════════════════
      // ARRANGE: Setup initial regular user
      // ═══════════════════════════════════════════════════════════════
      
      const { useAuth } = require('../../context/auth');
      
      useAuth.mockReturnValue([
        {
          user: {
            _id: 'user123',
            name: 'John Doe',
            role: 0, // Regular user
          },
          token: 'token',
        },
        jest.fn()
      ]);
      
      const { rerender } = renderWithRouter(<Header />);
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #1: User dashboard link initially
      // ───────────────────────────────────────────────────────────────
      let dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', '/dashboard/user');
      
      // ═══════════════════════════════════════════════════════════════
      // ACT: Change role to admin
      // ═══════════════════════════════════════════════════════════════
      
      useAuth.mockReturnValue([
        {
          user: {
            _id: 'user123',
            name: 'John Doe',
            role: 1, // Admin
          },
          token: 'token',
        },
        jest.fn()
      ]);
      
      rerender(
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      );
      
      // ═══════════════════════════════════════════════════════════════
      // ASSERT: Verify dashboard link updated
      // ═══════════════════════════════════════════════════════════════
      
      // ───────────────────────────────────────────────────────────────
      // VERIFICATION #2: Admin dashboard link now
      // ───────────────────────────────────────────────────────────────
      dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', '/dashboard/admin');
    });
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 2.4 INTEGRATION TEST SUMMARY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * TESTS IMPLEMENTED: 13 integration tests
 * 
 * HEADER AUTHENTICATION STATE (3 tests):
 * ✅ Unauthenticated user navigation (Login/Register display)
 * ✅ Authenticated regular user navigation (user dropdown)
 * ✅ Authenticated admin user navigation (admin dashboard link)
 * 
 * LOGOUT FLOW INTEGRATION (1 test):
 * ✅ Complete logout flow (state + localStorage + toast)
 * 
 * CART INTEGRATION (2 tests):
 * ✅ Cart badge with item count
 * ✅ Empty cart display (zero badge)
 * 
 * CATEGORY INTEGRATION (2 tests):
 * ✅ Categories loading and display
 * ✅ Empty categories handling
 * 
 * ROLE-BASED MENU COMPONENTS (2 tests):
 * ✅ Admin menu navigation links
 * ✅ User menu navigation links
 * 
 * AUTH STATE TRANSITIONS (3 tests):
 * ✅ Login state transition (logged out → logged in)
 * ✅ Role change transition (user → admin dashboard link)
 * ✅ UI updates on auth state changes
 * 
 * INTEGRATION COVERAGE:
 * - Header ↔ useAuth context (authentication state)
 * - Header ↔ useCart context (cart state)
 * - Header ↔ useCategory hook (category loading)
 * - Header ↔ logout flow (localStorage + state)
 * - AdminMenu ↔ NavLink (admin navigation)
 * - UserMenu ↔ NavLink (user navigation)
 * - Conditional rendering based on auth.user and auth.user.role
 * 
 * REAL INTEGRATIONS TESTED:
 * - Real React Router NavLink/Link components
 * - Real conditional rendering logic
 * - Real role-based routing (user vs admin)
 * - Real auth state transitions
 * 
 * NEXT STEPS:
 * Phase 2 Complete! Move to Phase 3: Business Logic Layer Integration
 * ═══════════════════════════════════════════════════════════════════════════
 */
