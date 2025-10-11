// Main JavaScript file for ParkHere web app
console.log('ParkHere main.js loaded');

// Import Firestore functions
import { addVehicle, getUserVehicles, setActiveVehicle, getParkingLocations, getParkingLocationById, startParkingSession, getActiveParkingTicket, getVehicleById } from './firestore.js';
import { showToast, showPopup, parseFirebaseError } from './ui.js';
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
    
    // Initialize Firebase Auth
    initializeAuth();
    
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
        
        if (user) {
            currentUser = user;
            console.log('User signed in:', user.uid);
        } else {
            currentUser = null;
            console.log('No user signed in');
            
            // Redirect to login if not on login/register pages
            const currentPage = getCurrentPage();
            if (currentPage !== 'login' && currentPage !== 'register' && currentPage !== 'index') {
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
            return;
        }

        // Demo data (campus-only). Later, fetch from Firestore if needed.
        const notifications = [
            { id: 1, app: 'Parkhere', message: 'Hey Amy, your parking at Parkir Lapangan Wahidin is confirmed.', time: 'Today, 5 PM', read: false, href: 'detail-parkir.html' },
            { id: 2, app: 'Parkhere', message: 'Ticket generated for Parkir APU. Show it at the entrance.', time: 'Today, 3 PM', read: true, href: 'tiket.html' },
            { id: 3, app: 'Parkhere', message: 'Payment received for Parkir FEB.', time: 'Yesterday, 9 PM', read: true, href: 'pembayaran.html' },
            { id: 4, app: 'Parkhere', message: 'Spot near you: Parkir Kantin has new availability.', time: 'Yesterday, 2 PM', read: false, href: 'home.html' }
        ];

        const listEl = document.getElementById('notification-list');
        const allTab = document.getElementById('tab-all');
        const unreadTab = document.getElementById('tab-unread');

        if (!listEl || !allTab || !unreadTab) {
            console.log('Notification elements not found');
            return;
        }

        function render(list) {
            listEl.innerHTML = '';
            list.forEach(n => {
                const card = document.createElement('div');
                card.className = 'notification-card';

                const icon = document.createElement('div');
                icon.className = 'notif-icon';
                icon.textContent = (n.app && n.app[0]) ? n.app[0] : 'P';

                const content = document.createElement('div');
                content.className = 'notif-content';

                const top = document.createElement('div');
                top.className = 'notif-top';

                const title = document.createElement('h4');
                title.className = 'notif-title';
                title.textContent = n.app || 'Notification';
                if (!n.read) {
                    const dot = document.createElement('span');
                    dot.className = 'unread-dot';
                    title.appendChild(dot);
                }

                const time = document.createElement('div');
                time.className = 'notif-time';
                time.textContent = n.time;

                top.appendChild(title);
                top.appendChild(time);

                const message = document.createElement('p');
                message.className = 'notif-message';
                message.textContent = n.message;

                const actions = document.createElement('div');
                actions.className = 'notif-actions';
                const link = document.createElement('a');
                link.href = n.href || '#';
                link.textContent = 'See more';
                actions.appendChild(link);

                content.appendChild(top);
                content.appendChild(message);
                content.appendChild(actions);

                card.appendChild(icon);
                card.appendChild(content);

                listEl.appendChild(card);
            });
        }

        function setActive(tab) {
            [allTab, unreadTab].forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        }

        allTab.addEventListener('click', () => {
            setActive(allTab);
            render(notifications);
        });

        unreadTab.addEventListener('click', () => {
            setActive(unreadTab);
            render(notifications.filter(n => !n.read));
        });

        // Initial render (All)
        setActive(allTab);
        render(notifications);
    } catch (error) {
        console.error('Error initializing notifications page:', error);
        showToast('error', 'Failed to load notifications');
    }
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
        
        // Add event listener for start parking button
        addStartParkingListener(locationId, activeVehicle.id);
        
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
        const vehicleType = activeVehicle.vehicleType.toLowerCase();
        const slotsData = locationData.slots && locationData.slots[vehicleType] ? 
            locationData.slots[vehicleType] : { available: 0, total: 0 };
        
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

// Add start parking button event listener
function addStartParkingListener(locationId, vehicleId) {
    const startParkingButton = document.getElementById('start-parking-button');
    
    if (startParkingButton) {
        startParkingButton.addEventListener('click', async function() {
            console.log('Start parking button clicked');
            
            try {
                // Show loading popup
                showPopup('info', 'Starting session...', 'Please wait while we start your parking session.', null);
                
                // Start the parking session
                const ticketId = await startParkingSession(currentUser.uid, vehicleId, locationId);
                
                console.log('Parking session started successfully:', ticketId);
                
                // Show success toast
                showToast('success', 'Session Started!');
                
                // Redirect to ticket page
                setTimeout(() => {
                    window.location.href = `tiket.html?id=${ticketId}`;
                }, 1500);
                
            } catch (error) {
                console.error('Error starting parking session:', error);
                const friendlyError = parseFirebaseError(error);
                showToast('error', friendlyError);
            }
        });
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
        
        // Add end parking button listener
        addEndParkingListener(ticketData.id);
        
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
    
    // Update timer immediately
    updateTimer(startDate, timerElement);
    
    // Update timer every second
    parkingTimer = setInterval(() => {
        updateTimer(startDate, timerElement);
    }, 1000);
}

// Update timer display
function updateTimer(startDate, timerElement) {
    const now = Date.now();
    const diffMs = now - startDate.getTime();
    
    // Convert milliseconds to hours, minutes, seconds
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    // Format as HH:MM:SS
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    timerElement.textContent = timeString;
}

// Add end parking button listener
function addEndParkingListener(ticketId) {
    const endButton = document.getElementById('end-parking-button');
    
    if (endButton) {
        endButton.addEventListener('click', function() {
            console.log('End parking button clicked');
            
            // Stop the timer
            if (parkingTimer) {
                clearInterval(parkingTimer);
                parkingTimer = null;
            }
            
            // Show toast and redirect with ticket ID
            showToast('success', 'Proceeding to payment...');
            setTimeout(() => {
                window.location.href = `pembayaran.html?id=${ticketId}`;
            }, 1500);
        });
    }
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

// Export functions for use in other modules
window.ParkHere = {
    showAlert,
    navigateTo,
    currentUser,
    parkingData
};
