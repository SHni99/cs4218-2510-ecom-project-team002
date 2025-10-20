/**
 * Phase 3.3: Payment Component Integration Tests
 * 
 * Purpose: Integration tests for CartPage payment processing with Braintree gateway
 * Focus: Payment flow, cart management, authentication integration, error handling
 * 
 * Integration Points:
 * - Braintree payment gateway (token generation, payment processing)
 * - Cart context (cart state management, localStorage sync)
 * - Auth context (user authentication, address validation)
 * - Navigation (checkout flow, order confirmation)
 * - Toast notifications (payment success/failure feedback)
 * - Layout component (page structure)
 * 
 * Test Strategy: Integration testing with mocked external dependencies (axios, Braintree SDK)
 * Real components: CartPage, Layout, useAuth, useCart
 */

import React, { useEffect } from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import CartPage from "../CartPage";
import { AuthProvider } from "../../context/auth";
import { CartProvider, useCart } from "../../context/cart";

// Mock axios with proper structure for AuthProvider
jest.mock("axios");

// Set up axios defaults structure that AuthProvider expects
axios.defaults = {
  headers: {
    common: {}
  }
};

// Mock toast notifications
jest.mock("react-hot-toast", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// Mock CSS
jest.mock("../../styles/CartStyles.css", () => ({}));

// Mock Layout - keep it real but simple
jest.mock("../../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

// Mock Braintree DropIn component
const mockRequestPaymentMethod = jest.fn();
jest.mock("braintree-web-drop-in-react", () => {
  const React = require("react");
  
  const DropIn = ({ onInstance, options }) => {
    const calledRef = React.useRef(false);
    
    React.useEffect(() => {
      if (calledRef.current) return;
      calledRef.current = true;
      
      // Simulate Braintree instance creation with a small delay to mimic real behavior
      const timer = setTimeout(() => {
        onInstance({ 
          requestPaymentMethod: mockRequestPaymentMethod 
        });
      }, 50);
      
      return () => clearTimeout(timer);
    }, [onInstance]);
    
    return (
      <div data-testid="braintree-dropin">
        <div data-testid="braintree-auth">{options.authorization}</div>
        Braintree Payment Widget
      </div>
    );
  };

  return { __esModule: true, default: DropIn };
});

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Helper: Render CartPage with all necessary providers
const renderCartPageWithProviders = () => {
  // Set up localStorage mock
  const localStorageMock = {
    getItem: jest.fn((key) => {
      if (key === "auth") return JSON.stringify({ user: { name: "Test User", address: "123 Test St" }, token: "test-token" });
      if (key === "cart") return JSON.stringify([{ _id: "prod1", name: "Test Product", price: 99.99, description: "Test description" }]);
      return null;
    }),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });

  return render(
    <MemoryRouter>
      <AuthProvider>
        <CartProvider>
          <CartPage />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

// Helper: Render CartPage with custom cart and auth
const renderCartPageWithCustomState = (cartItems = [], authUser = null) => {
  const localStorageMock = {
    getItem: jest.fn((key) => {
      if (key === "auth") {
        return authUser 
          ? JSON.stringify({ user: authUser, token: "test-token" })
          : null;
      }
      if (key === "cart") return JSON.stringify(cartItems);
      return null;
    }),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });

  return render(
    <MemoryRouter>
      <AuthProvider>
        <CartProvider>
          <CartPage />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe("CartPage Component Integration Tests - Phase 3: Business Logic Layer", () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPaymentMethod.mockResolvedValue({ nonce: "test-payment-nonce" });
    axios.get.mockResolvedValue({ data: { clientToken: "test-braintree-token" } });
    axios.post.mockResolvedValue({ data: { ok: true } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Test Group 1: Complete Payment Flow Integration ====================
  describe("Integration Test #1: Complete Payment Flow", () => {
    
    test("should complete full payment flow with authenticated user and valid cart", async () => {
      // Arrange: Set up authenticated user with cart items
      const cartItems = [
        { _id: "prod1", name: "Laptop", price: 999.99, description: "High-performance laptop" },
        { _id: "prod2", name: "Mouse", price: 29.99, description: "Wireless mouse" },
      ];
      const authUser = { name: "John Doe", address: "456 Main St" };
      
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: Wait for Braintree token to be fetched
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/v1/product/braintree/token");
      });

      // Assert: Braintree widget should be rendered with correct token
      const braintreeWidget = await screen.findByTestId("braintree-dropin");
      expect(braintreeWidget).toBeInTheDocument();
      expect(screen.getByTestId("braintree-auth")).toHaveTextContent("test-braintree-token");

      // Wait for payment button to be enabled (instance is set)
      await waitFor(() => {
        const paymentButton = screen.getByRole("button", { name: /make payment/i });
        expect(paymentButton).toBeEnabled();
      });

      // Act: Click payment button
      const paymentButton = screen.getByRole("button", { name: /make payment/i });
      fireEvent.click(paymentButton);

      // Assert: Payment processing flow
      await waitFor(() => {
        expect(mockRequestPaymentMethod).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          "/api/v1/product/braintree/payment",
          {
            nonce: "test-payment-nonce",
            cart: expect.arrayContaining([
              expect.objectContaining({ _id: "prod1" }),
              expect.objectContaining({ _id: "prod2" }),
            ]),
          }
        );
      });

      // Assert: Success flow - cart cleared, navigation to orders, toast shown
      await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith("cart");
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/orders");
        expect(toast.success).toHaveBeenCalledWith("Payment Completed Successfully ");
      });
    });

    test("should calculate and display correct cart total for multiple items", async () => {
      // Arrange: Cart with multiple items
      const cartItems = [
        { _id: "1", name: "Item 1", price: 100.50, description: "Desc 1" },
        { _id: "2", name: "Item 2", price: 200.75, description: "Desc 2" },
        { _id: "3", name: "Item 3", price: 50.25, description: "Desc 3" },
      ];
      const authUser = { name: "Test", address: "123 St" };

      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: Total should be sum of all prices (100.50 + 200.75 + 50.25 = 351.50)
      await waitFor(() => {
        expect(screen.getByText(/Total : \$351.50/i)).toBeInTheDocument();
      });
    });
  });

  // ==================== Test Group 2: Braintree Integration ====================
  describe("Integration Test #2: Braintree Payment Gateway Integration", () => {
    
    test("should fetch Braintree client token on component mount with auth", async () => {
      // Arrange & Act
      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];
      
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: Token API should be called
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/v1/product/braintree/token");
      });

      // Assert: Client token should be used to initialize Braintree
      const braintreeAuth = await screen.findByTestId("braintree-auth");
      expect(braintreeAuth).toHaveTextContent("test-braintree-token");
    });

    test("should handle Braintree token fetch error gracefully", async () => {
      // Arrange: Mock token fetch failure
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      axios.get.mockRejectedValue(new Error("Token fetch failed"));

      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      // Act
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: Error should be caught and logged
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith("/api/v1/product/braintree/token");
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Assert: Braintree widget should NOT be rendered without token
      await waitFor(() => {
        expect(screen.queryByTestId("braintree-dropin")).not.toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    test("should request payment method nonce from Braintree when paying", async () => {
      // Arrange
      const authUser = { name: "User", address: "123 Street" };
      const cartItems = [{ _id: "1", name: "Product", price: 100, description: "Test" }];

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for payment button to be enabled (instance is set)
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Click payment button
      const payButton = screen.getByRole("button", { name: /make payment/i });
      fireEvent.click(payButton);

      // Assert: Braintree requestPaymentMethod should be called
      await waitFor(() => {
        expect(mockRequestPaymentMethod).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    test("should send payment nonce to backend API", async () => {
      // Arrange
      mockRequestPaymentMethod.mockResolvedValueOnce({ nonce: "custom-nonce-123" });
      
      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "prod1", name: "Item", price: 50, description: "Desc" }];

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for payment button to be enabled (instance is set)
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Make payment
      const payButton = screen.getByRole("button", { name: /make payment/i });
      fireEvent.click(payButton);

      // Wait for requestPaymentMethod to be called first
      await waitFor(() => {
        expect(mockRequestPaymentMethod).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Assert: Backend should receive the nonce from Braintree
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith(
          "/api/v1/product/braintree/payment",
          expect.objectContaining({
            nonce: "custom-nonce-123",
          })
        );
      }, { timeout: 3000 });
    });
  });

  // ==================== Test Group 3: Cart Management Integration ====================
  describe("Integration Test #3: Cart Management Integration", () => {
    
    test("should display all cart items with correct details", async () => {
      // Arrange
      const cartItems = [
        { _id: "1", name: "Gaming Laptop", price: 1299.99, description: "High-end gaming laptop with RTX graphics" },
        { _id: "2", name: "Mechanical Keyboard", price: 149.99, description: "RGB mechanical gaming keyboard" },
      ];
      const authUser = { name: "Gamer", address: "789 Gaming Blvd" };

      // Act
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: All cart items should be displayed
      await waitFor(() => {
        expect(screen.getByText("Gaming Laptop")).toBeInTheDocument();
        expect(screen.getByText("Mechanical Keyboard")).toBeInTheDocument();
        expect(screen.getByText(/Price : 1299.99/)).toBeInTheDocument();
        expect(screen.getByText(/Price : 149.99/)).toBeInTheDocument();
      });

      // Assert: Truncated descriptions (30 chars)
      expect(screen.getByText("High-end gaming laptop with RT")).toBeInTheDocument();
      expect(screen.getByText("RGB mechanical gaming keyboard")).toBeInTheDocument();
    });

    test("should clear cart and localStorage after successful payment", async () => {
      // Arrange
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];
      const authUser = { name: "User", address: "Address" };

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for payment button to be enabled (instance is set)
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Complete payment
      fireEvent.click(screen.getByRole("button", { name: /make payment/i }));

      // Assert: Cart should be cleared from localStorage after payment
      await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith("cart");
      }, { timeout: 3000 });
    });

    test("should show empty cart message when cart is empty", async () => {
      // Arrange: Empty cart
      renderCartPageWithCustomState([], null);

      // Assert: Empty cart message should be displayed
      await waitFor(() => {
        expect(screen.getByText("Your Cart Is Empty")).toBeInTheDocument();
      });

      // Assert: Payment widget should NOT be shown
      expect(screen.queryByTestId("braintree-dropin")).not.toBeInTheDocument();
    });

    test("should display cart item count in header", async () => {
      // Arrange: Cart with 3 items
      const cartItems = [
        { _id: "1", name: "Item 1", price: 10, description: "Desc 1" },
        { _id: "2", name: "Item 2", price: 20, description: "Desc 2" },
        { _id: "3", name: "Item 3", price: 30, description: "Desc 3" },
      ];
      const authUser = { name: "User", address: "Address" };

      // Act
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: Item count should be displayed
      await waitFor(() => {
        expect(screen.getByText(/You Have 3 items in your cart/i)).toBeInTheDocument();
      });
    });
  });

  // ==================== Test Group 4: Authentication & Authorization Integration ====================
  describe("Integration Test #4: Authentication & Authorization Integration", () => {
    
    test("should show login prompt for unauthenticated users", async () => {
      // Arrange: No auth, with cart items
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      // Act
      renderCartPageWithCustomState(cartItems, null);

      // Assert: Login button should be displayed
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /please login to checkout/i })).toBeInTheDocument();
      });

      // Assert: Payment widget should NOT be shown without auth
      expect(screen.queryByTestId("braintree-dropin")).not.toBeInTheDocument();
    });

    test("should navigate to login page when unauthenticated user clicks checkout", async () => {
      // Arrange
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];
      renderCartPageWithCustomState(cartItems, null);

      // Act: Click login button
      const loginButton = await screen.findByRole("button", { name: /please login to checkout/i });
      fireEvent.click(loginButton);

      // Assert: Should navigate to login with cart redirect state
      expect(mockNavigate).toHaveBeenCalledWith("/login", { state: "/cart" });
    });

    test("should show update address prompt for authenticated user without address", async () => {
      // Arrange: User without address
      const authUser = { name: "User" }; // No address
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      // Act
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: Update address button should be shown
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /update address/i })).toBeInTheDocument();
      });

      // Assert: Payment button should be disabled without address
      await waitFor(() => {
        const payButton = screen.queryByRole("button", { name: /make payment/i });
        if (payButton) {
          expect(payButton).toBeDisabled();
        }
      });
    });

    test("should display user address when available", async () => {
      // Arrange: User with address
      const authUser = { name: "John Smith", address: "742 Evergreen Terrace, Springfield" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      // Act
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: Address should be displayed
      await waitFor(() => {
        expect(screen.getByText("Current Address")).toBeInTheDocument();
        expect(screen.getByText("742 Evergreen Terrace, Springfield")).toBeInTheDocument();
      });
    });

    test("should navigate to profile page when update address is clicked", async () => {
      // Arrange
      const authUser = { name: "User", address: "Old Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      renderCartPageWithCustomState(cartItems, authUser);

      // Act: Click update address button
      const updateButton = await screen.findByRole("button", { name: /update address/i });
      fireEvent.click(updateButton);

      // Assert: Should navigate to profile page
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/profile");
    });

    test("should greet authenticated user by name", async () => {
      // Arrange
      const authUser = { name: "Alice Johnson", address: "123 Test St" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      // Act
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: User greeting should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Hello\s+Alice Johnson/i)).toBeInTheDocument();
      });
    });

    test("should greet unauthenticated user as Guest", async () => {
      // Arrange: No auth
      renderCartPageWithCustomState([], null);

      // Assert: Guest greeting should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Hello Guest/i)).toBeInTheDocument();
      });
    });
  });

  // ==================== Test Group 5: Payment Error Handling ====================
  describe("Integration Test #5: Payment Error Handling", () => {
    
    test("should handle payment API error gracefully", async () => {
      // Arrange: Mock payment API failure
      axios.post.mockRejectedValueOnce(new Error("Payment declined"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for payment button to be enabled (instance is set)
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Attempt payment
      fireEvent.click(screen.getByRole("button", { name: /make payment/i }));

      // Assert: Wait for requestPaymentMethod to complete
      await waitFor(() => {
        expect(mockRequestPaymentMethod).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Assert: Error should be logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Assert: Cart should NOT be cleared on error
      expect(window.localStorage.removeItem).not.toHaveBeenCalledWith("cart");

      // Assert: Should not navigate on error
      expect(mockNavigate).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test("should handle Braintree requestPaymentMethod failure", async () => {
      // Arrange: Mock Braintree failure
      mockRequestPaymentMethod.mockRejectedValueOnce(new Error("Card validation failed"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for payment button to be enabled (instance is set)
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Try to make payment
      fireEvent.click(screen.getByRole("button", { name: /make payment/i }));

      // Assert: Error should be caught and logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Assert: Payment API should NOT be called if nonce retrieval fails
      expect(axios.post).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test("should show loading state during payment processing", async () => {
      // Arrange: Delay payment response to catch loading state
      axios.post.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { ok: true } }), 300)));

      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for button to be enabled
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Click payment button
      const payButton = screen.getByRole("button", { name: /make payment/i });
      fireEvent.click(payButton);

      // Wait for requestPaymentMethod to be called first
      await waitFor(() => {
        expect(mockRequestPaymentMethod).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Assert: Loading state should be shown
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /processing \.\.\.\./i })).toBeInTheDocument();
      }, { timeout: 3000 });

      // Wait for payment to complete
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    test("should disable payment button while processing", async () => {
      // Arrange: Delay payment significantly to catch loading state
      axios.post.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { ok: true } }), 500)));
      
      // Also delay requestPaymentMethod slightly to simulate real Braintree
      mockRequestPaymentMethod.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ nonce: "test-payment-nonce" }), 50))
      );

      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for button to be enabled before clicking
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Click payment button
      const payButton = screen.getByRole("button", { name: /make payment/i });
      fireEvent.click(payButton);

      // Assert: Button should change to "Processing ...." and be disabled
      await waitFor(() => {
        const processingButton = screen.getByRole("button", { name: /processing \.\.\.\./i });
        expect(processingButton).toBeInTheDocument();
        expect(processingButton).toBeDisabled();
      }, { timeout: 3000 });
      
      // Wait for completion to avoid act warnings
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  // ==================== Test Group 6: Navigation Integration ====================
  describe("Integration Test #6: Navigation Integration", () => {
    
    test("should navigate to orders page after successful payment", async () => {
      // Arrange
      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for payment button to be enabled (instance is set)
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Complete payment
      fireEvent.click(screen.getByRole("button", { name: /make payment/i }));

      // Assert: Should navigate to orders page
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/orders");
      }, { timeout: 3000 });
    });

    test("should include cart context in login redirect state", async () => {
      // Arrange: Unauthenticated user
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];
      renderCartPageWithCustomState(cartItems, null);

      // Act: Click login button
      const loginButton = await screen.findByRole("button", { name: /please login to checkout/i });
      fireEvent.click(loginButton);

      // Assert: Should pass /cart as state for redirect after login
      expect(mockNavigate).toHaveBeenCalledWith("/login", { state: "/cart" });
    });
  });

  // ==================== Test Group 7: Toast Notification Integration ====================
  describe("Integration Test #7: Toast Notification Integration", () => {
    
    test("should show success toast after payment completion", async () => {
      // Arrange
      const authUser = { name: "User", address: "Address" };
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];

      renderCartPageWithCustomState(cartItems, authUser);

      await waitFor(() => {
        expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
      });

      // Wait for payment button to be enabled (instance is set)
      await waitFor(() => {
        const payButton = screen.getByRole("button", { name: /make payment/i });
        expect(payButton).toBeEnabled();
      });

      // Act: Complete payment
      fireEvent.click(screen.getByRole("button", { name: /make payment/i }));

      // Assert: Success toast should be shown
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Payment Completed Successfully ");
      }, { timeout: 3000 });
    });
  });

  // ==================== Test Group 8: Layout Integration ====================
  describe("Integration Test #8: Layout Integration", () => {
    
    test("should render CartPage within Layout component", async () => {
      // Arrange & Act
      renderCartPageWithCustomState([], null);

      // Assert: Layout should be present
      await waitFor(() => {
        expect(screen.getByTestId("layout")).toBeInTheDocument();
      });
    });

    test("should display cart summary section", async () => {
      // Arrange
      const cartItems = [{ _id: "1", name: "Product", price: 50, description: "Test" }];
      const authUser = { name: "User", address: "Address" };

      // Act
      renderCartPageWithCustomState(cartItems, authUser);

      // Assert: Cart summary elements should be present
      await waitFor(() => {
        expect(screen.getByText("Cart Summary")).toBeInTheDocument();
        expect(screen.getByText("Total | Checkout | Payment")).toBeInTheDocument();
      });
    });
  });
});

const seedLocalStorage = (cartValue) => {
  const getItem = jest.fn((key) => {
    if (key !== "cart") return null;
    return cartValue == null ? null : JSON.stringify(cartValue);
  });
  const setItem = jest.fn();
  const removeItem = jest.fn();
  const clear = jest.fn();

  Object.defineProperty(window, "localStorage", {
    value: { getItem, setItem, removeItem, clear },
    writable: true,
  });

  return { getItem, setItem, removeItem, clear };
};

// A tiny consumer to observe provider behavior & re-renders
function Probe() {
  const [cart, setCart] = useCart();

  // Count renders to ensure consumer re-renders on updates
  const rendersRef = React.useRef(0);
  rendersRef.current += 1;

  useEffect(() => {
    // expose counts for assertions
    window.__probe__ = { renders: rendersRef.current, cart };
  }, [cart]);

  return (
    <div>
      <div data-testid="cart-length">{cart.length}</div>
      <button
        data-testid="push-item"
        onClick={() => setCart((prev) => [...prev, { _id: "x" }])}
      >
        push
      </button>
      <button data-testid="replace" onClick={() => setCart([{ _id: "y" }])}>
        replace
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <CartProvider>
      <Probe />
    </CartProvider>
  );
}

beforeEach(() => {
  jest.restoreAllMocks();
  // Default: empty storage unless overridden per test
  seedLocalStorage(null);
});

describe("CartContext integration (JS)", () => {
  test("initializes from localStorage (seeded cart)", async () => {
    const seed = [{ _id: "1", name: "A", price: 10 }];
    const spies = seedLocalStorage(seed);

    renderWithProvider();

    expect(spies.getItem).toHaveBeenCalledWith("cart");
    expect(screen.getByTestId("cart-length")).toHaveTextContent("1");
    expect(window.__probe__.cart).toEqual(seed);
  });

  test("exposes [cart, setCart] and updates state", async () => {
    seedLocalStorage([]);
    renderWithProvider();

    expect(screen.getByTestId("cart-length")).toHaveTextContent("0");

    await act(async () => {
      screen.getByTestId("replace").click();
    });

    expect(screen.getByTestId("cart-length")).toHaveTextContent("1");
    expect(window.__probe__.cart).toEqual([{ _id: "y" }]);
  });

  test("persists to localStorage when setCart uses direct value", async () => {
    const spies = seedLocalStorage([]);
    renderWithProvider();

    await act(async () => {
      screen.getByTestId("replace").click(); // sets [{ _id: "y" }]
    });

    expect(spies.setItem).toHaveBeenCalledWith(
      "cart",
      JSON.stringify([{ _id: "y" }])
    );
  });

  test("persists to localStorage when setCart uses functional update", async () => {
    const spies = seedLocalStorage([{ _id: "seed" }]);
    renderWithProvider();

    await act(async () => {
      screen.getByTestId("push-item").click(); // [...prev, { _id: "x" }]
    });

    expect(spies.setItem).toHaveBeenCalledWith(
      "cart",
      JSON.stringify([{ _id: "seed" }, { _id: "x" }])
    );
  });

  test("notifies consumers (re-render occurs on cart change)", async () => {
    seedLocalStorage([]);
    renderWithProvider();

    const before = window.__probe__.renders;
    await act(async () => {
      screen.getByTestId("push-item").click();
    });
    const after = window.__probe__.renders;

    expect(after).toBeGreaterThan(before); // consumer re-rendered
  });

  test("persists across reloads (unmount/remount reads from saved cart)", async () => {
    const spies = seedLocalStorage([]);
    const { unmount } = render(
      <CartProvider>
        <Probe />
      </CartProvider>
    );

    // Trigger a write: setCart([{ _id: "y" }])
    await act(async () => {
      screen.getByTestId("replace").click();
    });

    // Persist happens in a useEffect → wait for it
    await waitFor(() => {
      expect(spies.setItem).toHaveBeenCalledWith(
        "cart",
        JSON.stringify([{ _id: "y" }])
      );
    });

    // Simulate a page reload: unmount, then make getItem return the saved cart
    unmount();
    spies.getItem.mockImplementation((key) =>
      key === "cart" ? JSON.stringify([{ _id: "y" }]) : null
    );

    // Fresh render (not rerender), so the Provider's mount effect runs again
    render(
      <CartProvider>
        <Probe />
      </CartProvider>
    );

    // The Provider reads localStorage in a mount effect → wait for it
    await waitFor(() => {
      expect(screen.getByTestId("cart-length")).toHaveTextContent("1");
    });
    expect(window.__probe__.cart).toEqual([{ _id: "y" }]);
  });

  test("handles invalid JSON in localStorage (optional if provider adds try/catch)", async () => {
    const spies = seedLocalStorage(null);
    spies.getItem.mockImplementation((key) =>
      key === "cart" ? "{not-json" : null
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // With try/catch in provider, this should not throw
    renderWithProvider();

    // Defaults to empty cart, logs error, and removes the bad key
    expect(screen.getByTestId("cart-length")).toHaveTextContent("0");
    expect(errorSpy).toHaveBeenCalled();
    expect(spies.removeItem).toHaveBeenCalledWith("cart");

    errorSpy.mockRestore();
  });
});

