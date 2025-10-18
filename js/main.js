// Main JavaScript file for ParkHere web app
console.log('ParkHere main.js loaded');

// Import Firestore functions
import { addVehicle, getUserVehicles, setActiveVehicle, getParkingLocations, getParkingLocationById, startParkingSession, getActiveParkingTicket, getVehicleById, endParkingSession, getActiveVehicle, getParkingHistoryById, getUserParkingHistory, saveNotification, getUserNotifications, markNotificationAsRead } from './firestore.js';
import { showToast, showPopup, parseFirebaseError, showParkingStartNotification, showParkingEndNotification, showPaymentSuccessNotification, showPaymentFailedNotification } from './ui.js';
import { getCurrentUser } from './auth.js';

// Global variables
let currentUser = null;
let parkingData = [];
let selectedCategory = 'Car'; // Track current filter category
let parkingTimer = null; // Track the timer interval

// Google Maps API Key (for production, store this securely in environment variables)
const GOOGLE_MAPS_API_KEY = 'AIzaSyDLaI2cD-47gGjqsSdQElgIh197SdAnaLQ';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('ParkHere app initialized');
    
    // Initialize Firebase Auth for all pages (landing page doesn't load this script)
    initializeAuth();
    
    // Test notification system (temporary for debugging)
    if (window.location.pathname.includes('home.html')) {
        console.log('Adding test notification button...');
        setTimeout(() => {
            const testButton = document.createElement('button');
            testButton.innerHTML = 'Test Notification';
            testButton.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                z-index: 9999;
                background: #F2C84F;
                color: #000;
                border: none;
                padding: 10px;
                border-radius: 5px;
                cursor: pointer;
            `;
            testButton.onclick = () => {
                console.log('Testing notification...');
                showParkingStartNotification('Test Location', 'Car - B1234TEST');
            };
            document.body.appendChild(testButton);
        }, 2000);
    }
    
    // Password visibility toggle for login form
    const toggleLoginPassword = document.getElementById('toggle-login-password');
    if (toggleLoginPassword) {
        toggleLoginPassword.addEventListener('click', function() {
            const passwordInput = document.getElementById('login-password');
            const toggleIcon = this.querySelector('i');
            
            if (passwordInput && toggleIcon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleIcon.className = 'ph ph-eye';
                } else {
                    passwordInput.type = 'password';
                    toggleIcon.className = 'ph ph-eye-slash';
                }
            }
        });
    }
    
    // Password visibility toggle for registration form
    const toggleRegisterPassword = document.getElementById('toggle-register-password');
    if (toggleRegisterPassword) {
        toggleRegisterPassword.addEventListener('click', function() {
            const passwordInput = document.getElementById('register-password');
            const toggleIcon = this.querySelector('i');
            
            if (passwordInput && toggleIcon) {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    toggleIcon.className = 'ph ph-eye';
                } else {
                    passwordInput.type = 'password';
                    toggleIcon.className = 'ph ph-eye-slash';
                }
            }
        });
    }
});

// Get current page name
function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop().split('.')[0];
    return page;
}

// Initialize page-specific functionality
async function initializePage(page) {
    try {
        // Get current user (simplified - in real app, get from auth)
        currentUser = await getCurrentUser();
        
        switch (page) {
            case 'home':
                await initializeHomePage();
                break;
            case 'notification':
                await initializeNotificationsPage();
                break;
            case 'add-vehicle':
                await initializeAddVehiclePage();
                break;
            case 'vehicle-list':
                await initializeVehicleListPage();
                break;
            case 'detail-parkir':
                await initializeDetailPage();
                break;
            case 'tiket':
                await initializeTicketPage();
                break;
            case 'pembayaran':
                await initializePaymentPage();
                break;
            case 'riwayat':
                await initializeHistoryPage();
                break;
            default:
                console.log('No specific initialization for page:', page);
        }
    } catch (error) {
        console.error('Error initializing page:', error);
    }
}

// Initialize Firebase Auth
async function initializeAuth() {
    try {
        // Get the current authenticated user
        const user = await getCurrentUser();
        
        const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');

        if (user) { // User is logged in
            currentUser = user;
            console.log('User signed in:', user.uid);
            
            if (isAuthPage) {
                console.log('Logged-in user on auth page, redirecting to home');
                window.location.href = 'home.html';
                return;
            }
        } else { // User is not logged in
            currentUser = null;
            console.log('No user signed in');
            
            if (!isAuthPage) {
                console.log('Unauthenticated user on protected page, redirecting to login');
                window.location.href = 'login.html';
                return;
            }
        }
        
        // Get current page and initialize
        const currentPage = getCurrentPage();
        console.log('Current page:', currentPage);
        initializePage(currentPage);
        
    } catch (error) {
        console.error('Error initializing auth:', error);
    }
}


// Home page initialization
async function initializeHomePage() {
    console.log('Initializing home page');
    
    try {
        if (!currentUser) {
            console.log('No user authenticated for home page');
            return;
        }
        
        const vehicles = await getUserVehicles(currentUser.uid);
        const addVehicleBtn = document.getElementById('addVehicleBtn');
        const selectedVehicle = document.getElementById('selectedVehicle');
        
        if (vehicles.length === 0) {
            // No vehicles - show add vehicle button
            if (addVehicleBtn) addVehicleBtn.classList.remove('d-none');
            if (selectedVehicle) selectedVehicle.classList.add('d-none');
        } else {
            // Has vehicles - show active vehicle
            const activeVehicle = vehicles.find(v => v.isActive) || vehicles[0];
            
            if (addVehicleBtn) addVehicleBtn.classList.add('d-none');
            if (selectedVehicle) {
                selectedVehicle.classList.remove('d-none');
                updateVehicleDisplay(activeVehicle);
            }
        }
        
        // Display parking spots
        await displayParkingSpots();
        
        // Initialize category filter buttons
        initializeCategoryFilters();
        
        // Handle geolocation
        handleGeolocation();
    } catch (error) {
        console.error('Error loading vehicles for home page:', error);
        showToast('error', 'Failed to load vehicle information');
    }
}

// Update vehicle display on home page
function updateVehicleDisplay(vehicle) {
    const vehicleType = document.querySelector('#selectedVehicle .vehicle-type');
    const vehiclePlate = document.querySelector('#selectedVehicle .vehicle-plate');
    
    if (vehicleType) {
        vehicleType.textContent = vehicle.vehicleType;
        vehicleType.className = 'vehicle-type text-capitalize-custom';
    }
    if (vehiclePlate) {
        vehiclePlate.textContent = vehicle.licensePlate;
        vehiclePlate.className = 'vehicle-plate text-uppercase-custom';
    }
}

// Handle geolocation for home page
async function handleGeolocation() {
    console.log('Handling geolocation');
    
    // Check if geolocation is supported
    if (!("geolocation" in navigator)) {
        console.log('Geolocation is not supported by this browser');
        showToast('error', 'Geolocation is not supported by your browser');
        return;
    }
    
    // Get current position
    navigator.geolocation.getCurrentPosition(
        // Success callback
        async function(position) {
            console.log('Geolocation success:', position);
            
            try {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                
                console.log('User coordinates:', latitude, longitude);
                
                // Create geocoder instance
                const geocoder = new google.maps.Geocoder();
                
                // Perform reverse geocoding
                geocoder.geocode({
                    location: { lat: latitude, lng: longitude }
                }, function(results, status) {
                    if (status === 'OK' && results[0]) {
                        console.log('Geocoding results:', results);
                        
                        // Get a suitable address
                        let address = results[0].formatted_address;
                        
                        // Try to get a more specific address (like sublocality)
                        const result = results[0];
                        if (result.address_components) {
                            for (let component of result.address_components) {
                                if (component.types.includes('sublocality') || 
                                    component.types.includes('locality') ||
                                    component.types.includes('administrative_area_level_2')) {
                                    address = component.long_name;
                                    break;
                                }
                            }
                        }
                        
                        // Update location text
                        const locationText = document.getElementById('location-text');
                        if (locationText) {
                            locationText.textContent = address;
                            console.log('Updated location text to:', address);
                        }
                        
                        showToast('success', 'Location updated successfully');
                        
                    } else {
                        console.error('Geocoding failed:', status);
                        showToast('error', 'Failed to get address from location');
                    }
                });
                
            } catch (error) {
                console.error('Error processing geolocation:', error);
                showToast('error', 'Failed to process location data');
            }
        },
        // Error callback
        function(error) {
            console.error('Geolocation error:', error);
            
            let errorMessage = 'Failed to get your location';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access denied. Please allow location access to get your current address.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out.';
                    break;
                default:
                    errorMessage = 'An unknown error occurred while retrieving location.';
                    break;
            }
            
            showToast('error', errorMessage);
        },
        // Options
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        }
    );
}

// Display parking spots on home page
async function displayParkingSpots() {
    console.log('Displaying parking spots');
    
    const container = document.getElementById('spot-list-container');
    if (!container) {
        console.log('Parking spots container not found');
        return;
    }
    
    try {
        // Show loading state
        container.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-warning" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-white">Loading parking spots...</p>
            </div>
        `;
        
        // Fetch parking locations from Firestore with current category filter
        let parkingLocations = await getParkingLocations(selectedCategory);
        
        // Filter to only the allowed on-campus spots as requested
        const allowedNames = [
            'Parkir APU',
            'Parkir Lapangan Wahidin',
            'Parkir Kantin',
            'Parkir FEB'
        ];
        parkingLocations = (parkingLocations || []).filter(loc => allowedNames.includes((loc.name || '').trim()))
            .map(loc => ({ ...loc, name: (loc.name || '').trim() }));

        // Ensure the UI shows all four allowed spots. If any are missing from Firestore,
        // add placeholder entries so the list is complete for the demo.
        const existingByName = new Map(parkingLocations.map(l => [l.name, l]));
        const placeholderByName = {
            'Parkir APU': { name: 'Parkir APU', pricePerDay: 3000, slots: { car: { available: 60, total: 100 } } },
            'Parkir Lapangan Wahidin': { name: 'Parkir Lapangan Wahidin', pricePerDay: 3000, slots: { car: { available: 80, total: 100 } } },
            'Parkir Kantin': { name: 'Parkir Kantin', pricePerDay: 3000, slots: { car: { available: 40, total: 80 } } },
            'Parkir FEB': { name: 'Parkir FEB', pricePerDay: 3000, slots: { car: { available: 50, total: 90 } } }
        };
        allowedNames.forEach(n => {
            if (!existingByName.has(n)) {
                parkingLocations.push(placeholderByName[n]);
            }
        });
        
        // Clear container
        container.innerHTML = '';
        
        if (parkingLocations.length === 0) {
            // Show empty state
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="ph ph-parking" style="font-size: 3rem; color: #A0A0A0; margin-bottom: 1rem;"></i>
                    <h3 style="color: #FFFFFF; margin-bottom: 0.5rem;">No Parking Spots Found</h3>
                    <p style="color: #A0A0A0;">There are no parking locations available at the moment.</p>
                </div>
            `;
        } else {
            // Render parking spot cards
            parkingLocations.forEach(location => {
                const card = createParkingSpotCard(location);
                container.appendChild(card);
            });
        }
        
    } catch (error) {
        console.error('Error displaying parking spots:', error);
        
        // Show error state
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="ph ph-warning-circle" style="font-size: 3rem; color: #F2C84F; margin-bottom: 1rem;"></i>
                <h3 style="color: #FFFFFF; margin-bottom: 0.5rem;">Failed to Load Parking Spots</h3>
                <p style="color: #A0A0A0; margin-bottom: 2rem;">There was an error loading parking locations. Please try again.</p>
                <button class="btn btn-primary-yellow" onclick="location.reload()">
                    <i class="ph ph-arrow-clockwise me-2"></i>
                    Try Again
                </button>
            </div>
        `;
        
        showToast('error', 'Failed to load parking spots');
    }
}

// Create parking spot card element
function createParkingSpotCard(location) {
    const card = document.createElement('div');
    card.className = 'spot-card mb-3 p-3 rounded';
    card.style.cssText = 'background-color: #2C2C2C; cursor: pointer; transition: all 0.3s ease;';
    card.setAttribute('data-id', location.id);
    
    // Add hover effect
    card.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#3A3A3A';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '#2C2C2C';
    });
    
    // Format price
    const formattedPrice = location.pricePerDay ? `Rp${location.pricePerDay.toLocaleString()}/day` : 'Rp3,000/day';
    
    // Get slots data for the selected category
    const categoryKey = selectedCategory.toLowerCase();
    const slotsData = location.slots && location.slots[categoryKey] ? location.slots[categoryKey] : { available: 0, total: 0 };
    const availableSlots = slotsData.available || 0;
    const totalSlots = slotsData.total || 0;
    
    // Create card content
    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-2">
                    <div class="spot-image-placeholder me-3">
                        <i class="ph ph-parking" style="font-size: 1.5rem; color: #A0A0A0;"></i>
                    </div>
                    <div>
                        <h5 class="mb-1 text-white">${location.name || 'Parking Location'}</h5>
                        <p class="mb-0 text-white" style="font-size: 0.9rem; font-weight: 600;">${formattedPrice}</p>
                    </div>
                </div>
            </div>
            <div class="text-end">
                <div class="availability-tag">
                    ${availableSlots} / ${totalSlots} available
                </div>
            </div>
        </div>
    `;
    
    // Add click event listener
    card.addEventListener('click', function() {
        const locationId = this.dataset.id;
        if (locationId) {
            console.log('Parking location clicked:', locationId);
            window.location.href = `detail-parkir.html?id=${locationId}`;
        }
    });
    
    return card;
}

// Initialize category filter buttons
function initializeCategoryFilters() {
    console.log('Initializing category filters');
    
    // Get category buttons
    const carButton = document.getElementById('car-category-btn');
    const motorcycleButton = document.getElementById('motorcycle-category-btn');
    
    // Car button click listener
    if (carButton) {
        carButton.addEventListener('click', async function() {
            console.log('Car category selected');
            selectedCategory = 'Car';
            
            // Update UI
            carButton.classList.add('active');
            if (motorcycleButton) motorcycleButton.classList.remove('active');
            
            // Refresh parking spots
            await displayParkingSpots();
        });
    }
    
    // Motorcycle button click listener
    if (motorcycleButton) {
        motorcycleButton.addEventListener('click', async function() {
            console.log('Motorcycle category selected');
            selectedCategory = 'Motorcycle';
            
            // Update UI
            motorcycleButton.classList.add('active');
            if (carButton) carButton.classList.remove('active');
            
            // Refresh parking spots
            await displayParkingSpots();
        });
    }
}

// Notifications page initialization
async function initializeNotificationsPage() {
    console.log('Initializing notifications page');
    try {
        if (!currentUser) {
            console.log('No user authenticated for notifications page');
            showToast('error', 'Please log in to view notifications');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        // Load user notifications from Firestore
        await loadUserNotifications('all');
        
        // Setup tab switching
        setupNotificationTabs();
        
    } catch (error) {
        console.error('Error initializing notifications page:', error);
        showToast('error', 'Failed to load notifications');
    }
}

// Load user notifications
async function loadUserNotifications(filter = 'all') {
    try {
        console.log('Loading notifications with filter:', filter);
        
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) {
            console.error('Notification list element not found');
            return;
        }
        
        // Show loading state
        notificationList.innerHTML = `
            <div class="loading-state">
                <div class="spinner-border text-warning" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p>Loading notifications...</p>
            </div>
        `;
        
        // Fetch notifications from Firestore
        const notifications = await getUserNotifications(currentUser.uid, filter);
        console.log('Fetched notifications:', notifications);
        
        if (notifications.length === 0) {
            renderEmptyNotifications();
            return;
        }
        
        // Render notifications
        renderNotifications(notifications);
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        showToast('error', 'Failed to load notifications');
        renderErrorState();
    }
}

// Setup notification tabs
function setupNotificationTabs() {
    const tabAll = document.getElementById('tab-all');
    const tabUnread = document.getElementById('tab-unread');
    
    if (tabAll) {
        tabAll.addEventListener('click', async () => {
            console.log('Switching to All notifications');
            tabAll.classList.add('active');
            tabUnread.classList.remove('active');
            await loadUserNotifications('all');
        });
    }
    
    if (tabUnread) {
        tabUnread.addEventListener('click', async () => {
            console.log('Switching to Unread notifications');
            tabUnread.classList.add('active');
            tabAll.classList.remove('active');
            await loadUserNotifications('unread');
        });
    }
}

// Render notifications list
function renderNotifications(notifications) {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    notificationList.innerHTML = '';
    
    notifications.forEach(notification => {
        const notificationElement = createNotificationElement(notification);
        notificationList.appendChild(notificationElement);
    });
}

// Create notification element
function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item ${!notification.isRead ? 'unread' : ''}`;
    div.style.cssText = `
        background-color: #2C2C2C;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        border-left: 4px solid ${getNotificationColor(notification.type)};
        cursor: pointer;
        transition: all 0.2s ease;
    `;
    
    // Add hover effect
    div.addEventListener('mouseenter', () => {
        div.style.backgroundColor = '#3C3C3C';
    });
    
    div.addEventListener('mouseleave', () => {
        div.style.backgroundColor = '#2C2C2C';
    });
    
    // Add click handler to mark as read
    div.addEventListener('click', async () => {
        if (!notification.isRead) {
            try {
                await markNotificationAsRead(notification.id);
                notification.isRead = true;
                div.classList.remove('unread');
                div.style.borderLeft = `4px solid ${getNotificationColor(notification.type)}`;
            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        }
    });
    
    const timeAgo = formatTimeAgo(notification.createdAt);
    
    div.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: #F2C84F;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            ">
                <i class="ph ph-${getNotificationIcon(notification.type)}" style="
                    font-size: 18px;
                    color: #000;
                "></i>
            </div>
            <div style="flex: 1;">
                <div style="
                    color: #FFFFFF;
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 4px;
                ">${notification.title}</div>
                <div style="
                    color: #A0A0A0;
                    font-size: 13px;
                    line-height: 1.4;
                    margin-bottom: 8px;
                ">${notification.message}</div>
                <div style="
                    color: #8E8E93;
                    font-size: 12px;
                ">${timeAgo}</div>
            </div>
            ${!notification.isRead ? `
                <div style="
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #F2C84F;
                    flex-shrink: 0;
                    margin-top: 4px;
                "></div>
            ` : ''}
        </div>
    `;
    
    return div;
}

// Get notification color based on type
function getNotificationColor(type) {
    const colors = {
        'parking_start': '#10B981',
        'parking_end': '#3B82F6',
        'payment_success': '#10B981',
        'payment_failed': '#EF4444'
    };
    return colors[type] || '#3C3C3C';
}

// Get notification icon based on type
function getNotificationIcon(type) {
    const icons = {
        'parking_start': 'car',
        'parking_end': 'clock',
        'payment_success': 'check-circle',
        'payment_failed': 'x-circle'
    };
    return icons[type] || 'bell';
}

// Format time ago
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    
    const now = new Date();
    const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return time.toLocaleDateString();
}

// Render empty state
function renderEmptyNotifications() {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    notificationList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i class="ph ph-bell-slash"></i>
            </div>
            <h3>No notifications</h3>
            <p>You don't have any notifications yet.</p>
        </div>
    `;
}

// Render error state
function renderErrorState() {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    notificationList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i class="ph ph-warning-circle"></i>
            </div>
            <h3>Failed to load</h3>
            <p>Unable to load notifications. Please try again.</p>
        </div>
    `;
}

// Detail page initialization
async function initializeDetailPage() {
    console.log('Initializing detail page');
    
    try {
        // Get the location ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const locationId = urlParams.get('id');
        
        if (!locationId) {
            console.log('No location ID found in URL');
            showToast('error', 'Invalid parking location');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
            return;
        }
        
        console.log('Loading parking location:', locationId);
        
        // Show loading state
        updateDetailPageLoadingState();
        
        // Fetch parking location data
        const locationData = await getParkingLocationById(locationId);
        
        if (!locationData) {
            console.log('Parking location not found');
            showToast('error', 'Parking location not found');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
            return;
        }
        
        // DEBUG: Add comprehensive logging for location data
        console.log("Location data fetched:", locationData);
        if (locationData.location) {
            console.log("Geopoint exists:", locationData.location);
            console.log("Latitude:", locationData.location.latitude);
            console.log("Longitude:", locationData.location.longitude);
        } else {
            console.error("CRITICAL: Geopoint field ('location') is missing from the Firestore document!");
            console.log("Available fields in locationData:", Object.keys(locationData));
        }
        
        // Get user's active vehicle to determine vehicle type
        const vehicles = await getUserVehicles(currentUser.uid);
        const activeVehicle = vehicles.find(v => v.isActive) || vehicles[0];
        
        if (!activeVehicle) {
            console.log('No active vehicle found');
            showToast('error', 'Please add a vehicle first');
            setTimeout(() => {
                window.location.href = 'add-vehicle.html';
            }, 2000);
            return;
        }
        
        // Render the parking location data with vehicle-specific slot counts
        renderParkingLocationDetail(locationData, activeVehicle);
        
        // Load static map image
        loadStaticMap(locationData);
        
        // Add event listener for start parking button with new logic
        const startParkingButton = document.getElementById('start-parking-button');
        if (startParkingButton) {
            startParkingButton.addEventListener('click', async () => {
                try {
                    showToast('info', 'Starting session...');
                    startParkingButton.disabled = true;

                    const user = await getCurrentUser();
                    const activeVehicle = await getActiveVehicle(user.uid);

                    if (!user) {
                        throw new Error("User not found.");
                    }

                    if (!activeVehicle) {
                        showToast('error', 'Please select an active vehicle first.');
                        startParkingButton.disabled = false;
                        return; // Stop execution
                    }

                    // Panggil fungsi yang sudah diperbaiki
                    const newTicketId = await startParkingSession(user.uid, activeVehicle, locationId);
                    
                    // Show parking start notification
                    console.log('=== CALLING PARKING START NOTIFICATION ===');
                    console.log('Location Data:', locationData);
                    console.log('Active Vehicle:', activeVehicle);
                    
                    const vehicleInfo = `${activeVehicle.type} - ${activeVehicle.plate}`;
                    console.log('Vehicle Info String:', vehicleInfo);
                    
                    // Show popup notification
                    showParkingStartNotification(locationData.name, vehicleInfo);
                    
                    // Save notification to Firestore
                    try {
                        await saveNotification(user.uid, {
                            type: 'parking_start',
                            title: 'Parking Started',
                            message: `Your parking session at ${locationData.name} has started. Vehicle: ${vehicleInfo}`,
                            locationName: locationData.name,
                            vehicleInfo: vehicleInfo
                        });
                        console.log('Parking start notification saved to Firestore');
                    } catch (error) {
                        console.error('Error saving parking start notification:', error);
                    }
                    
                    // JIKA BERHASIL, BARU REDIRECT
                    showToast('success', 'Session started!');
                    window.location.href = `tiket.html?id=${newTicketId}`;

                } catch (error) {
                    console.error("Gagal memulai sesi dari UI:", error);
                    showToast('error', error.message);
                    startParkingButton.disabled = false;
                }
            });
        }
        
    } catch (error) {
        console.error('Error initializing detail page:', error);
        showToast('error', 'Failed to load parking details');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);
    }
}

// Update detail page loading state
function updateDetailPageLoadingState() {
    const locationName = document.getElementById('location-name');
    const availableSlots = document.getElementById('available-slots');
    const totalSlots = document.getElementById('total-slots');
    const priceDisplay = document.getElementById('price-display');
    
    if (locationName) locationName.textContent = 'Loading...';
    if (availableSlots) availableSlots.textContent = '--';
    if (totalSlots) totalSlots.textContent = '--';
    if (priceDisplay) priceDisplay.textContent = '--';
}

// Render parking location detail data
function renderParkingLocationDetail(locationData, activeVehicle) {
    console.log('Rendering parking location detail:', locationData, 'for vehicle:', activeVehicle);
    
    // Update location name
    const locationName = document.getElementById('location-name');
    if (locationName) {
        locationName.textContent = locationData.name || 'Parking Location';
    }
    
    // Update availability display based on vehicle type
    const availableSlots = document.getElementById('available-slots');
    const totalSlots = document.getElementById('total-slots');
    
    if (availableSlots && totalSlots) {
        // Handle different possible field names for vehicle type
        const vehicleTypeField = activeVehicle.vehicleType || activeVehicle.type || activeVehicle.vehicle_type;
        if (!vehicleTypeField) {
            console.error("Vehicle type field not found in activeVehicle:", activeVehicle);
            availableSlots.textContent = "0";
            totalSlots.textContent = "0";
            return;
        }
        
        const vehicleType = vehicleTypeField.toLowerCase();
        console.log("Rendering slots for vehicle type:", vehicleType);
        console.log("Location slots data:", locationData.slots);
        
        const slotsData = locationData.slots && locationData.slots[vehicleType] ? 
            locationData.slots[vehicleType] : { available: 0, total: 0 };
        
        console.log("Slots data for", vehicleType, ":", slotsData);
        
        availableSlots.textContent = slotsData.available || 0;
        totalSlots.textContent = slotsData.total || 0;
    }
    
    // Update price display
    const priceDisplay = document.getElementById('price-display');
    if (priceDisplay) {
        const formattedPrice = locationData.pricePerDay ? 
            `Rp${locationData.pricePerDay.toLocaleString()}/day` : 
            'Price not available';
        priceDisplay.textContent = formattedPrice;
    }
}

// Load static map image for detail page
function loadStaticMap(locationData) {
    console.log('Loading static map for location:', locationData);
    
    try {
        // Check if location has coordinates
        if (!locationData.location || !locationData.location.latitude || !locationData.location.longitude) {
            console.log('No coordinates available for this location');
            console.log('Location data structure:', locationData);
            return;
        }
        
        const latitude = locationData.location.latitude;
        const longitude = locationData.location.longitude;
        
        console.log('Location coordinates:', latitude, longitude);
        console.log('API Key being used:', GOOGLE_MAPS_API_KEY);
        
        // Construct the static map URL with proper formatting
        const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
            `center=${latitude},${longitude}&` +
            `zoom=17&` +
            `size=600x300&` +
            `maptype=roadmap&` +
            `markers=color:red|label:P|${latitude},${longitude}&` +
            `key=${GOOGLE_MAPS_API_KEY}`;
        
        console.log('Generated Static Map URL:', staticMapUrl);
        
        // Find the image placeholder element
        const imagePlaceholder = document.getElementById('detail-image-placeholder');
        if (imagePlaceholder) {
            console.log('Found image placeholder element:', imagePlaceholder);
            
            // Set the background image with proper URL formatting
            imagePlaceholder.style.backgroundImage = `url('${staticMapUrl}')`;
            imagePlaceholder.style.backgroundSize = 'cover';
            imagePlaceholder.style.backgroundPosition = 'center';
            imagePlaceholder.style.backgroundRepeat = 'no-repeat';
            
            // Hide the placeholder icon since we now have a map
            const placeholderIcon = imagePlaceholder.querySelector('i');
            if (placeholderIcon) {
                placeholderIcon.style.display = 'none';
                console.log('Hidden placeholder icon');
            }
            
            console.log('Successfully applied background image.');
            console.log('Applied styles:', {
                backgroundImage: imagePlaceholder.style.backgroundImage,
                backgroundSize: imagePlaceholder.style.backgroundSize,
                backgroundPosition: imagePlaceholder.style.backgroundPosition
            });
        } else {
            console.error("Element with ID 'detail-image-placeholder' not found!");
        }
        
    } catch (error) {
        console.error('Error loading static map:', error);
        showToast('error', 'Failed to load map image');
    }
}


// Ticket page initialization
async function initializeTicketPage() {
    console.log('Initializing ticket page');
    
    try {
        // Get current user
        if (!currentUser) {
            console.log('No user authenticated for ticket page');
            showToast('error', 'Please log in to view your parking ticket');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        // Fetch active parking ticket
        const ticketData = await getActiveParkingTicket(currentUser.uid);
        
        if (!ticketData) {
            console.log('No active parking ticket found');
            showNoActiveTicketState();
            return;
        }
        
        // Fetch related data
        const [locationData, vehicleData] = await Promise.all([
            getParkingLocationById(ticketData.locationId),
            getVehicleById(ticketData.vehicleId)
        ]);
        
        // Render ticket information
        renderTicketData(ticketData, locationData, vehicleData);
        
        // Start the timer
        startParkingTimer(ticketData.startTime);
        
        // Add end parking button listener with new logic
        const endParkingButton = document.getElementById('end-parking-button');
        const startTime = ticketData.startTime.toDate();
        const ticketId = ticketData.id;
        
        if (endParkingButton) {
            endParkingButton.addEventListener('click', async () => {
                // 1. HENTIKAN TIMER DULU!
                if (window.parkingTimerInterval) {
                    clearInterval(window.parkingTimerInterval);
                }

                // 2. HITUNG DURASI & BIAYA FINAL
                const finalDurationInSeconds = Math.max(0, Math.floor((new Date() - startTime) / 1000));
                const finalAmount = 3000; // Harga demo kita per hari

                console.log(`Mengakhiri sesi. Durasi: ${finalDurationInSeconds} detik, Biaya: ${finalAmount}`);

                // Tampilkan loading state
                showToast('info', 'Ending session...');
                endParkingButton.disabled = true;

                // 3. PANGGIL FUNGSI FIRESTORE DENGAN DATA YANG BENAR
                try {
                    console.log("=== CALLING endParkingSession ===");
                    console.log("Parameters:", { ticketId, finalDurationInSeconds, finalAmount });
                    
                    const result = await endParkingSession(ticketId, finalDurationInSeconds, finalAmount);
                    
                    console.log("=== endParkingSession SUCCESS ===");
                    console.log("Result:", result);
                    
                    // Show parking end notification
                    const durationFormatted = formatDuration(finalDurationInSeconds);
                    showParkingEndNotification(locationData.name, durationFormatted, finalAmount);
                    
                    // Save notification to Firestore
                    try {
                        await saveNotification(currentUser.uid, {
                            type: 'parking_end',
                            title: 'Parking Ended',
                            message: `Your parking session at ${locationData.name} has ended. Duration: ${durationFormatted}, Amount: Rp ${finalAmount.toLocaleString()}`,
                            locationName: locationData.name,
                            duration: durationFormatted,
                            amount: finalAmount
                        });
                        console.log('Parking end notification saved to Firestore');
                    } catch (error) {
                        console.error('Error saving parking end notification:', error);
                    }
                    
                    // 4. JIKA BERHASIL, REDIRECT TO PAYMENT PAGE
                    console.log("Redirecting to payment page with history ID:", result);
                    window.location.href = `pembayaran.html?historyId=${result}&duration=${finalDurationInSeconds}&amount=${finalAmount}`;

                } catch (error) {
                    // 5. JIKA GAGAL, BERI TAHU PENGGUNA
                    console.error("=== endParkingSession FAILED ===");
                    console.error("Error object:", error);
                    console.error("Error message:", error.message);
                    console.error("Error code:", error.code);
                    console.error("Error stack:", error.stack);
                    showToast('error', 'Failed to end session. Please try again.');
                    endParkingButton.disabled = false; // Aktifkan lagi tombolnya
                }
            });
        }
        
    } catch (error) {
        console.error('Error initializing ticket page:', error);
        showToast('error', 'Failed to load parking ticket');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);
    }
}

// Show no active ticket state
function showNoActiveTicketState() {
    const container = document.querySelector('.container .row .col-12');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="ph ph-parking" style="font-size: 4rem; color: #A0A0A0; margin-bottom: 1rem;"></i>
                <h3 style="color: #FFFFFF; margin-bottom: 0.5rem;">No Active Parking Session</h3>
                <p style="color: #A0A0A0; margin-bottom: 2rem;">You don't have any active parking sessions.</p>
                <a href="home.html" class="btn btn-primary-yellow">
                    <i class="ph ph-house me-2"></i>
                    Go to Home
                </a>
            </div>
        `;
    }
}


// Render ticket data
function renderTicketData(ticketData, locationData, vehicleData) {
    console.log('Rendering ticket data:', ticketData, locationData, vehicleData);
    
    // Update location name
    const locationName = document.getElementById('ticket-location-name');
    if (locationName) {
        locationName.textContent = locationData?.name || 'Unknown Location';
    }
    
    // Update vehicle info
    const vehicleInfo = document.getElementById('ticket-vehicle-info');
    if (vehicleInfo) {
        const vehicleText = vehicleData ? 
            `${vehicleData.vehicleType} - ${vehicleData.licensePlate}` : 
            'Unknown Vehicle';
        vehicleInfo.textContent = vehicleText;
    }
    
    // Update start time
    const startTime = document.getElementById('ticket-start-time');
    if (startTime) {
        const startDate = ticketData.startTime.toDate();
        const timeString = startDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        startTime.textContent = `Start time: ${timeString}`;
    }
}

// Start the parking timer
function startParkingTimer(startTime) {
    console.log('Starting parking timer from:', startTime);
    
    const timerElement = document.getElementById('parking-timer');
    if (!timerElement) return;
    
    // Clear any existing timer
    if (parkingTimer) {
        clearInterval(parkingTimer);
    }
    
    // Convert Firestore timestamp to JavaScript Date
    const startDate = startTime.toDate();
    
    // Clear any previous timer to prevent multiple timers running
    if (window.parkingTimerInterval) {
        clearInterval(window.parkingTimerInterval);
    }

    function updateTimer() {
        const now = new Date();
        // Calculate total elapsed seconds from the start time
        const elapsedTimeInSeconds = Math.max(0, Math.floor((now - startDate) / 1000));

        const hours = Math.floor(elapsedTimeInSeconds / 3600);
        const minutes = Math.floor((elapsedTimeInSeconds % 3600) / 60);
        const seconds = elapsedTimeInSeconds % 60;

        // Format to HH:MM:SS
        const formattedTime = [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0')
        ].join(':');

        if (timerElement) {
            timerElement.textContent = formattedTime;
        }
    }

    // Start the timer
    updateTimer(); // Run once immediately
    window.parkingTimerInterval = setInterval(updateTimer, 1000);
}



// Add vehicle page initialization
async function initializeAddVehiclePage() {
    console.log('Initializing add vehicle page');
    
    const saveButton = document.querySelector('button[type="submit"]');
    if (saveButton) {
        saveButton.addEventListener('click', handleSaveVehicle);
    }
}

// Helper function to capitalize first letter
function capitalizeFirstLetter(str) {
    return str.trim().charAt(0).toUpperCase() + str.trim().slice(1).toLowerCase();
}

// Handle save vehicle
async function handleSaveVehicle(event) {
    event.preventDefault();
    
    try {
        // Get the current authenticated user
        const user = await getCurrentUser();
        
        if (user) {
            console.log("User detected:", user.uid);
            
            // Get form values
            const rawLicensePlate = document.getElementById('licensePlate').value;
            const vehicleType = document.querySelector('input[name="vehicleType"]:checked')?.value;
            const rawVehicleColor = document.getElementById('vehicleColor').value;
            
            // Validate form fields
            if (!rawLicensePlate || !vehicleType || !rawVehicleColor) {
                showToast('error', 'Please fill in all fields');
                return;
            }
            
            // Format the input values
            const licensePlate = rawLicensePlate.trim().toUpperCase();
            const vehicleColor = capitalizeFirstLetter(rawVehicleColor);
            
            // Create vehicle data object with formatted values
            const vehicleData = {
                licensePlate,
                vehicleType,
                color: vehicleColor
            };
            
            // Save vehicle to Firestore with real user ID
            await addVehicle(user.uid, vehicleData);
            
            // Show success popup and redirect
            showPopup('success', 'Vehicle Added!', 'Your vehicle has been successfully saved.', () => {
                window.location.href = 'vehicle-list.html';
            });
            
        } else {
            console.log("No user is logged in.");
            showToast('error', 'You must be logged in.');
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }
        
    } catch (error) {
        console.error('Error saving vehicle:', error);
        const friendlyError = parseFirebaseError(error);
        showToast('error', friendlyError);
    }
}

// Vehicle list page initialization
async function initializeVehicleListPage() {
    console.log('Initializing vehicle list page');
    
    const loadingSpinner = document.getElementById('loading-spinner');
    const vehicleList = document.getElementById('vehicleList');
    
    try {
        if (!currentUser) {
            console.log('No user authenticated for vehicle list page');
            // Hide loading spinner
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            return;
        }
        
        const vehicles = await getUserVehicles(currentUser.uid);
        
        // Hide loading spinner after data is fetched
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        
        if (vehicles.length === 0) {
            // Show empty state
            if (vehicleList) vehicleList.innerHTML = createEmptyState();
        } else {
            // Render vehicle cards
            if (vehicleList) {
                vehicleList.innerHTML = '';
                vehicles.forEach(vehicle => {
                    const vehicleCard = createVehicleCardElement(vehicle);
                    vehicleList.appendChild(vehicleCard);
                });
            }
        }
        
        // Add click listeners to vehicle cards
        addVehicleCardListeners();
        
    } catch (error) {
        console.error('Error loading vehicles for list page:', error);
        
        // Hide loading spinner on error
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        
        // Show error state
        if (vehicleList) {
            vehicleList.innerHTML = `
                <div class="text-center py-5">
                    <i class="ph ph-warning-circle" style="font-size: 3rem; color: #F2C84F; margin-bottom: 1rem;"></i>
                    <h3 style="color: #FFFFFF; margin-bottom: 0.5rem;">Failed to Load Vehicles</h3>
                    <p style="color: #A0A0A0; margin-bottom: 2rem;">There was an error loading your vehicles. Please try again.</p>
                    <button class="btn btn-primary-yellow" onclick="location.reload()">
                        <i class="ph ph-arrow-clockwise me-2"></i>
                        Try Again
                    </button>
                </div>
            `;
        }
        
        showToast('error', 'Failed to load vehicles');
    }
}

// Create empty state HTML
function createEmptyState() {
    return `
        <div class="empty-state text-center py-5">
            <i class="ph ph-car" style="font-size: 4rem; color: #A0A0A0; margin-bottom: 1rem;"></i>
            <h3 style="color: #FFFFFF; margin-bottom: 0.5rem;">No Vehicles Added</h3>
            <p style="color: #A0A0A0; margin-bottom: 2rem;">You haven't added any vehicles yet.</p>
            <a href="add-vehicle.html" class="btn btn-primary-yellow">
                <i class="ph ph-plus me-2"></i>
                Add Your First Vehicle
            </a>
        </div>
    `;
}

// Create vehicle card DOM element
function createVehicleCardElement(vehicle) {
    // Create the main card div
    const card = document.createElement('div');
    card.className = `vehicle-card ${vehicle.isActive ? 'selected' : ''}`;
    card.setAttribute('data-vehicle-id', vehicle.id);
    
    // Create the inner content div
    const contentDiv = document.createElement('div');
    contentDiv.className = 'd-flex justify-content-between align-items-center';
    
    // Create vehicle info section
    const vehicleInfo = document.createElement('div');
    vehicleInfo.className = 'vehicle-info';
    
    const vehicleType = document.createElement('h3');
    vehicleType.className = 'vehicle-type text-capitalize-custom';
    vehicleType.textContent = vehicle.vehicleType;
    
    const vehicleDetails = document.createElement('p');
    vehicleDetails.className = 'vehicle-details';
    
    // Create formatted display with helper classes
    const licensePlateSpan = document.createElement('span');
    licensePlateSpan.className = 'text-uppercase-custom';
    licensePlateSpan.textContent = vehicle.licensePlate;
    
    const colorSpan = document.createElement('span');
    if (vehicle.color) {
        colorSpan.className = 'text-capitalize-custom';
        colorSpan.textContent = ' | ' + vehicle.color;
    }
    
    vehicleDetails.appendChild(licensePlateSpan);
    if (vehicle.color) {
        vehicleDetails.appendChild(colorSpan);
    }
    
    vehicleInfo.appendChild(vehicleType);
    vehicleInfo.appendChild(vehicleDetails);
    
    // Create right side section
    const rightSection = document.createElement('div');
    rightSection.className = 'd-flex align-items-center';
    
    // Create vehicle illustration
    const vehicleIllustration = document.createElement('div');
    vehicleIllustration.className = 'vehicle-illustration me-3';
    
    const vehicleIcon = document.createElement('i');
    vehicleIcon.className = `ph ${vehicle.vehicleType === 'car' ? 'ph-car' : 'ph-motorcycle'} vehicle-icon`;
    
    vehicleIllustration.appendChild(vehicleIcon);
    
    // Assemble the right section (without selection indicator)
    rightSection.appendChild(vehicleIllustration);
    
    // Assemble the content div
    contentDiv.appendChild(vehicleInfo);
    contentDiv.appendChild(rightSection);
    
    // Assemble the card
    card.appendChild(contentDiv);
    
    return card;
}

// Add click listeners to vehicle cards
function addVehicleCardListeners() {
    const vehicleCards = document.querySelectorAll('.vehicle-card');
    
    vehicleCards.forEach(card => {
        card.addEventListener('click', async function() {
            const vehicleId = this.dataset.vehicleId;
            
            try {
                if (!currentUser) {
                    showToast('error', 'You must be logged in to select a vehicle');
                    return;
                }
                
                await setActiveVehicle(currentUser.uid, vehicleId);
                
                // Update UI
                vehicleCards.forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
                
                showToast('success', 'Vehicle selected successfully');
                
            } catch (error) {
                console.error('Error setting active vehicle:', error);
                const friendlyError = parseFirebaseError(error);
                showToast('error', friendlyError);
            }
        });
    });
}

// Utility functions
function showAlert(message, type = 'info') {
    // Create and show Bootstrap alert
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.insertBefore(alertDiv, document.body.firstChild);
}

// Navigation functions
function navigateTo(page) {
    window.location.href = `${page}.html`;
}

// Payment page initialization
async function initializePaymentPage() {
    console.log('Initializing payment page');
    
    try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const historyId = urlParams.get('historyId');
        const duration = parseInt(urlParams.get('duration')) || 0;
        const amount = parseInt(urlParams.get('amount')) || 3000;
        
        console.log('Payment page parameters:', { historyId, duration, amount });
        
        if (!historyId) {
            showToast('error', 'Invalid payment session');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
            return;
        }
        
        // Get parking history data
        const historyData = await getParkingHistoryById(historyId);
        if (!historyData) {
            showToast('error', 'Parking session not found');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
            return;
        }
        
        console.log('History data:', historyData);
        
        // Populate payment summary
        populatePaymentSummary(historyData, duration, amount);
        
        // Setup payment method selection
        setupPaymentMethodSelection();
        
        // Setup pay now button
        setupPayNowButton(historyId, amount);
        
    } catch (error) {
        console.error('Error initializing payment page:', error);
        showToast('error', 'Failed to load payment details');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);
    }
}

// Populate payment summary with parking data
function populatePaymentSummary(historyData, duration, amount) {
    // Location
    const locationElement = document.getElementById('payment-location');
    if (locationElement) {
        locationElement.textContent = historyData.locationName || 'Unknown Location';
    }
    
    // Vehicle
    const vehicleElement = document.getElementById('payment-vehicle');
    if (vehicleElement) {
        const vehicleType = historyData.vehicleType || 'Unknown';
        const licensePlate = historyData.licensePlate || 'Unknown';
        vehicleElement.textContent = `${vehicleType} - ${licensePlate}`;
    }
    
    // Duration
    const durationElement = document.getElementById('payment-duration');
    if (durationElement) {
        durationElement.textContent = formatDuration(duration);
    }
    
    // Start time
    const startTimeElement = document.getElementById('payment-start-time');
    if (startTimeElement) {
        const startTime = historyData.startTime ? historyData.startTime.toDate() : new Date();
        startTimeElement.textContent = startTime.toLocaleString();
    }
    
    // Parking fee
    const parkingFeeElement = document.getElementById('parking-fee');
    if (parkingFeeElement) {
        parkingFeeElement.textContent = `Rp ${amount.toLocaleString()}`;
    }
    
    // Total amount
    const totalAmountElement = document.getElementById('total-amount');
    if (totalAmountElement) {
        const totalAmount = amount + 500; // Add service fee
        totalAmountElement.textContent = `Rp ${totalAmount.toLocaleString()}`;
    }
}

// Setup payment method selection
function setupPaymentMethodSelection() {
    const paymentMethods = document.querySelectorAll('.payment-method');
    
    paymentMethods.forEach(method => {
        method.addEventListener('click', () => {
            // Remove selected class from all methods
            paymentMethods.forEach(m => m.classList.remove('selected'));
            
            // Add selected class to clicked method
            method.classList.add('selected');
            
            // Check the radio button
            const radio = method.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
        });
    });
}

// Setup pay now button
function setupPayNowButton(historyId, amount) {
    const payNowButton = document.getElementById('pay-now-button');
    
    if (payNowButton) {
        payNowButton.addEventListener('click', async () => {
            // Check if payment method is selected
            const selectedMethod = document.querySelector('input[name="payment-method"]:checked');
            if (!selectedMethod) {
                showToast('error', 'Please select a payment method');
                return;
            }
            
            const paymentMethod = selectedMethod.value;
            console.log('Selected payment method:', paymentMethod);
            
            // Disable button and show loading
            payNowButton.disabled = true;
            payNowButton.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Processing...</span>';
            
            try {
                // Simulate payment processing
                await simulatePaymentProcessing(paymentMethod, amount);
                
                // Show payment success notification
                showPaymentSuccessNotification(amount);
                
                // Save notification to Firestore
                try {
                    await saveNotification(currentUser.uid, {
                        type: 'payment_success',
                        title: 'Payment Successful',
                        message: `Your payment of Rp ${amount.toLocaleString()} has been processed successfully.`,
                        amount: amount
                    });
                    console.log('Payment success notification saved to Firestore');
                } catch (error) {
                    console.error('Error saving payment success notification:', error);
                }
                
                // Show success and redirect
                showPopup('success', 'Payment Successful', 'Your payment has been processed successfully!', () => {
                    window.location.href = 'payment-success.html?historyId=' + historyId;
                });
                
            } catch (error) {
                console.error('Payment failed:', error);
                showPaymentFailedNotification();
                
                // Save notification to Firestore
                try {
                    await saveNotification(currentUser.uid, {
                        type: 'payment_failed',
                        title: 'Payment Failed',
                        message: 'Your payment could not be processed. Please try again.',
                        amount: amount
                    });
                    console.log('Payment failed notification saved to Firestore');
                } catch (saveError) {
                    console.error('Error saving payment failed notification:', saveError);
                }
                
                showToast('error', 'Payment failed. Please try again.');
                
                // Re-enable button
                payNowButton.disabled = false;
                payNowButton.innerHTML = '<i class="ph ph-credit-card"></i><span>Pay Now</span>';
            }
        });
    }
}

// Simulate payment processing
async function simulatePaymentProcessing(method, amount) {
    console.log(`Processing ${method} payment for Rp ${amount}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate random success/failure (90% success rate)
    if (Math.random() < 0.9) {
        console.log('Payment processed successfully');
        return true;
    } else {
        throw new Error('Payment gateway error');
    }
}

// Format duration helper function
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
}

// History page initialization
async function initializeHistoryPage() {
    console.log('Initializing history page');
    
    try {
        // Check if this is a refresh request
        const urlParams = new URLSearchParams(window.location.search);
        const isRefresh = urlParams.get('refresh') === 'true';
        
        if (isRefresh) {
            console.log('Refresh requested, clearing URL parameters');
            // Remove the refresh parameter from URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Setup tab switching
        setupTabSwitching();
        
        // Load user's parking history
        await loadParkingHistory();
        
        // Add page visibility listener to refresh data when user returns
        setupPageVisibilityListener();
        
    } catch (error) {
        console.error('Error initializing history page:', error);
        showToast('error', 'Failed to load transaction history');
    }
}

// Setup page visibility listener to refresh data when user returns
function setupPageVisibilityListener() {
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden) {
            console.log('Page became visible, refreshing transaction data...');
            await loadParkingHistory();
        }
    });
    
    // Also refresh when the page gains focus
    window.addEventListener('focus', async () => {
        console.log('Window gained focus, refreshing transaction data...');
        await loadParkingHistory();
    });
}

// Setup tab switching functionality
function setupTabSwitching() {
    const activeTab = document.getElementById('active-tab');
    const historyTab = document.getElementById('history-tab');
    const activeSection = document.getElementById('active-section');
    const historySection = document.getElementById('history-section');
    
    if (activeTab && historyTab && activeSection && historySection) {
        activeTab.addEventListener('click', () => switchTab('active'));
        historyTab.addEventListener('click', () => switchTab('history'));
    }
}

// Switch between tabs
async function switchTab(tab) {
    const activeTab = document.getElementById('active-tab');
    const historyTab = document.getElementById('history-tab');
    const activeSection = document.getElementById('active-section');
    const historySection = document.getElementById('history-section');
    
    if (tab === 'active') {
        activeTab.classList.add('active');
        historyTab.classList.remove('active');
        activeSection.style.display = 'block';
        historySection.style.display = 'none';
        
        // Refresh active section data when switching to active tab
        console.log('Switching to active tab, refreshing data...');
        await refreshActiveSection();
    } else {
        historyTab.classList.add('active');
        activeTab.classList.remove('active');
        historySection.style.display = 'block';
        activeSection.style.display = 'none';
    }
}

// Refresh active section data
async function refreshActiveSection() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            console.log('No user found, cannot refresh active section');
            return;
        }
        
        const activeTicket = await getActiveParkingTicket(user.uid);
        updateActiveSection(activeTicket);
    } catch (error) {
        console.error('Error refreshing active section:', error);
    }
}

// Load parking history from Firestore
async function loadParkingHistory() {
    const loadingState = document.getElementById('loading-state');
    const transactionsList = document.getElementById('transactions-list');
    
    try {
        // Show loading state
        if (loadingState) {
            loadingState.style.display = 'block';
        }
        
        // Get current user
        const user = await getCurrentUser();
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        // Fetch both active and completed transactions
        const [activeTickets, historyData] = await Promise.all([
            getActiveParkingTicket(user.uid),
            getUserParkingHistory(user.uid)
        ]);
        
        // Hide loading state
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        // Render transactions
        if (historyData && historyData.length > 0) {
            renderTransactionCards(historyData);
        } else {
            renderEmptyState();
        }
        
        // Update active section
        updateActiveSection(activeTickets);
        
    } catch (error) {
        console.error('Error loading parking history:', error);
        
        // Hide loading state
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        // Show error state
        if (transactionsList) {
            transactionsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="ph ph-warning"></i>
                    </div>
                    <h3>Failed to Load</h3>
                    <p>Unable to load your transaction history. Please try again.</p>
                    <button class="btn btn-primary-yellow" onclick="location.reload()">
                        <i class="ph ph-arrow-clockwise"></i>
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

// Update active section with current parking ticket
function updateActiveSection(activeTicket) {
    const activeSection = document.getElementById('active-section');
    
    if (!activeSection) return;
    
    if (activeTicket) {
        // Show active parking session
        activeSection.innerHTML = `
            <div class="transaction-card">
                <div class="transaction-header">
                    <div class="transaction-status">
                        <i class="ph ph-clock"></i>
                        <span>Parking Active</span>
                    </div>
                    <div class="transaction-date">Now</div>
                </div>
                
                <div class="transaction-vehicle">
                    ${activeTicket.vehicleType || 'Unknown'} - ${activeTicket.licensePlate || 'Unknown'}
                </div>
                
                <div class="transaction-location">
                    <i class="ph ph-map-pin"></i>
                    <span>${activeTicket.locationName || 'Unknown Location'}</span>
                </div>
                
                <div class="transaction-details">
                    <div class="transaction-duration">
                        <i class="ph ph-clock"></i>
                        <span>Started: ${activeTicket.startTime ? activeTicket.startTime.toDate().toLocaleTimeString() : 'Unknown'}</span>
                    </div>
                    <div class="transaction-cost">Active</div>
                </div>
                
                <div class="transaction-actions">
                    <button class="btn btn-primary-yellow" onclick="window.location.href='tiket.html?id=${activeTicket.id}'">
                        <i class="ph ph-eye"></i>
                        View Ticket
                    </button>
                </div>
            </div>
        `;
    } else {
        // Show empty state for active
        activeSection.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="ph ph-clock"></i>
                </div>
                <h3>No Active Transactions</h3>
                <p>You don't have any active parking sessions at the moment.</p>
                <button class="btn btn-primary-yellow" onclick="window.location.href='home.html'">
                    <i class="ph ph-plus"></i>
                    Start Parking
                </button>
            </div>
        `;
    }
}

// Render transaction cards
function renderTransactionCards(transactions) {
    const transactionsList = document.getElementById('transactions-list');
    
    if (!transactionsList) return;
    
    transactionsList.innerHTML = '';
    
    transactions.forEach(transaction => {
        const card = createTransactionCard(transaction);
        transactionsList.appendChild(card);
    });
}

// Create a transaction card element
function createTransactionCard(transaction) {
    const card = document.createElement('div');
    card.className = 'transaction-card';
    
    // Format date
    const date = transaction.endTime ? transaction.endTime.toDate() : new Date();
    const formattedDate = date.toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Format duration
    const duration = transaction.duration || 0;
    const durationText = formatDuration(duration);
    
    // Format cost
    const cost = transaction.amount || 0;
    const formattedCost = `Rp ${cost.toLocaleString()}`;
    
    card.innerHTML = `
        <div class="transaction-header">
            <div class="transaction-status">
                <i class="ph ph-check-circle"></i>
                <span>Parking Complete</span>
            </div>
            <div class="transaction-date">${formattedDate}</div>
        </div>
        
        <div class="transaction-vehicle">
            ${transaction.vehicleType || 'Unknown'} - ${transaction.licensePlate || 'Unknown'}
        </div>
        
        <div class="transaction-location">
            <i class="ph ph-map-pin"></i>
            <span>${transaction.locationName || 'Unknown Location'}</span>
        </div>
        
        <div class="transaction-details">
            <div class="transaction-duration">
                <i class="ph ph-clock"></i>
                <span>${durationText}</span>
            </div>
            <div class="transaction-cost">${formattedCost}</div>
        </div>
    `;
    
    return card;
}

// Render empty state
function renderEmptyState() {
    const transactionsList = document.getElementById('transactions-list');
    
    if (!transactionsList) return;
    
    transactionsList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i class="ph ph-clock-counter-clockwise"></i>
            </div>
            <h3>No Transaction History</h3>
            <p>You haven't completed any parking sessions yet.</p>
            <button class="btn btn-primary-yellow" onclick="window.location.href='home.html'">
                <i class="ph ph-plus"></i>
                Start Parking
            </button>
        </div>
    `;
}

// Export functions for use in other modules
window.ParkHere = {
    showAlert,
    navigateTo,
    currentUser,
    parkingData
};
