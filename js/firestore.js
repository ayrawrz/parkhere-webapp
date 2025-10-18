// Firestore database operations for ParkHere web app
console.log('ParkHere firestore.js loaded');

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc, writeBatch, getDoc, runTransaction, serverTimestamp, deleteDoc } from 'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA9ptLHZoLaExf9hK4uUdrhNNZRkjk-BUI",
    authDomain: "parkhere-2025.firebaseapp.com",
    projectId: "parkhere-2025",
    storageBucket: "parkhere-2025.firebasestorage.app",
    messagingSenderId: "56999479616",
    appId: "1:56999479616:web:4819b71d79d946a66212a5",
    measurementId: "G-CBFWBYZ8ZR"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Parking Location Functions
export async function getParkingLocations(category) {
    try {
        console.log('Fetching parking locations from Firestore for category:', category);
        
        const parkingLocationsRef = collection(db, 'parkingLocations');
        const q = query(parkingLocationsRef, where("availableFor", "array-contains", category));
        const querySnapshot = await getDocs(q);
        
        const locations = [];
        querySnapshot.forEach((doc) => {
            locations.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Found parking locations for', category, ':', locations);
        return locations;
    } catch (error) {
        console.error('Error fetching parking locations:', error);
        
        // If it's a permissions error, provide helpful message
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. Please check your Firestore security rules and ensure you are authenticated.');
        }
        
        // Return empty array on error
        return [];
    }
}

export async function getParkingLocationById(locationId) {
    try {
        console.log('Fetching parking location by ID:', locationId);
        
        const locationRef = doc(db, 'parkingLocations', locationId);
        const locationSnap = await getDoc(locationRef);
        
        if (locationSnap.exists()) {
            const locationData = {
                id: locationSnap.id,
                ...locationSnap.data()
            };
            console.log('Found parking location:', locationData);
            return locationData;
        } else {
            console.log('No parking location found with ID:', locationId);
            return null;
        }
    } catch (error) {
        console.error('Error fetching parking location by ID:', error);
        
        // If it's a permissions error, provide helpful message
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. Please check your Firestore security rules and ensure you are authenticated.');
        }
        
        // Return null on error
        return null;
    }
}

export async function startParkingSession(userId, activeVehicle, locationId) {
    const db = getFirestore();
    const locationRef = doc(db, "parkingLocations", locationId);
    const newTicketRef = doc(collection(db, "activeParkings")); // Siapkan referensi tiket baru

    console.log("--- Memulai Transaksi Start Parking ---");
    console.log("UserID:", userId);
    console.log("VehicleID:", activeVehicle.id);
    console.log("LocationID:", locationId);

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Dapatkan data lokasi parkir
            const locationDoc = await transaction.get(locationRef);
            if (!locationDoc.exists()) {
                throw new Error("Lokasi parkir tidak ditemukan!");
            }
            const locationData = locationDoc.data();
            console.log("Data Lokasi:", locationData);
            console.log("Location data keys:", Object.keys(locationData));

            // 2. Tentukan tipe kendaraan dan cek slot
            console.log("Active vehicle data:", activeVehicle);
            console.log("Available fields:", Object.keys(activeVehicle));
            
            // Handle different possible field names for vehicle type
            const vehicleTypeField = activeVehicle.vehicleType || activeVehicle.type || activeVehicle.vehicle_type;
            if (!vehicleTypeField) {
                throw new Error("Vehicle type field not found in vehicle data");
            }
            
            const vehicleType = vehicleTypeField.toLowerCase();
            console.log("Looking for slots for vehicle type:", vehicleType);
            console.log("Location slots data:", locationData.slots);
            
            // Check if slots data exists and has the vehicle type
            if (!locationData.slots) {
                throw new Error("No slots data found in location");
            }
            
            if (!locationData.slots[vehicleType]) {
                console.log("Available slot types:", Object.keys(locationData.slots));
                throw new Error(`No slots found for vehicle type: ${vehicleType}`);
            }
            
            const currentSlots = locationData.slots[vehicleType];
            console.log(`Slot untuk ${vehicleType}:`, currentSlots);
            
            // Check if currentSlots has the available property
            if (!currentSlots || typeof currentSlots.available === 'undefined') {
                throw new Error(`Invalid slot data for ${vehicleType}. Available property not found.`);
            }

            if (currentSlots.available <= 0) {
                throw new Error("Parkir penuh untuk jenis kendaraan ini!");
            }

            // 3. Kurangi slot
            transaction.update(locationRef, {
                [`slots.${vehicleType}.available`]: currentSlots.available - 1
            });
            console.log("Slot berhasil dikurangi.");

            // 4. Buat tiket baru
            const licensePlateField = activeVehicle.licensePlate || activeVehicle.plate || activeVehicle.license_plate;
            const ticketData = {
                userId: userId,
                vehicleId: activeVehicle.id,
                vehicleType: vehicleTypeField, // Use the resolved vehicle type
                licensePlate: licensePlateField, // Use the resolved license plate
                locationId: locationId,
                locationName: locationData.name,
                startTime: serverTimestamp(),
                status: "active"
            };
            transaction.set(newTicketRef, ticketData);
            console.log("Tiket baru berhasil dibuat di transaksi.");
        });

        console.log("--- Transaksi Start Parking BERHASIL ---");
        return newTicketRef.id; // Kembalikan ID tiket baru

    } catch (error) {
        console.error("--- Transaksi Start Parking GAGAL ---", error);
        throw error; // Lemparkan error agar bisa ditangkap oleh UI
    }
}

// Get active vehicle for user
export async function getActiveVehicle(userId) {
    try {
        console.log('Fetching active vehicle for user:', userId);
        
        const db = getFirestore();
        const vehiclesRef = collection(db, 'vehicles');
        const q = query(vehiclesRef, where('userId', '==', userId), where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            console.log('No active vehicle found for user');
            return null;
        }
        
        const activeVehicleDoc = querySnapshot.docs[0];
        const rawData = activeVehicleDoc.data();
        console.log('Raw vehicle data from Firestore:', rawData);
        
        const activeVehicleData = {
            id: activeVehicleDoc.id,
            ...rawData // Use spread operator to flatten
        };
        console.log('Active vehicle found (flat object):', activeVehicleData);
        console.log('Available fields in activeVehicleData:', Object.keys(activeVehicleData));
        return activeVehicleData;
        
    } catch (error) {
        console.error('Error fetching active vehicle:', error);
        return null;
    }
}

export async function getActiveParkingTicket(userId) {
    try {
        console.log('=== FETCHING ACTIVE PARKING TICKET ===');
        console.log('User ID:', userId);
        
        const activeParkingsRef = collection(db, 'activeParkings');
        const q = query(activeParkingsRef, where('userId', '==', userId), where('status', '==', 'active'));
        const querySnapshot = await getDocs(q);
        
        console.log('Query results count:', querySnapshot.docs.length);
        
        if (querySnapshot.empty) {
            console.log('No active parking ticket found for user:', userId);
            return null;
        }
        
        // Check if there are multiple active tickets (this shouldn't happen)
        if (querySnapshot.docs.length > 1) {
            console.warn('WARNING: Multiple active tickets found!', querySnapshot.docs.length);
            querySnapshot.docs.forEach((doc, index) => {
                console.log(`Ticket ${index + 1}:`, doc.id, doc.data());
            });
            
            // Clean up duplicate tickets - keep the most recent one
            console.log('Cleaning up duplicate active tickets...');
            await cleanupDuplicateActiveTickets(userId, querySnapshot.docs);
            
            // Re-fetch after cleanup
            const newQuerySnapshot = await getDocs(q);
            if (newQuerySnapshot.empty) {
                console.log('No active tickets after cleanup');
                return null;
            }
            const ticketDoc = newQuerySnapshot.docs[0];
            const rawData = ticketDoc.data();
            const ticketData = {
                id: ticketDoc.id,
                ...rawData
            };
            console.log('Found active parking ticket after cleanup:', ticketData);
            return ticketData;
        }
        
        // Get the first (and should be only) document
        const ticketDoc = querySnapshot.docs[0];
        const rawData = ticketDoc.data();
        console.log('Raw ticket data from Firestore:', rawData);
        console.log('Start time from Firestore:', rawData.startTime);
        console.log('Start time type:', typeof rawData.startTime);
        
        const ticketData = {
            id: ticketDoc.id,
            ...rawData
        };
        
        console.log('Found active parking ticket (processed):', ticketData);
        console.log('Available fields in ticket data:', Object.keys(ticketData));
        console.log('=== END FETCHING ACTIVE PARKING TICKET ===');
        return ticketData;
        
    } catch (error) {
        console.error('Error fetching active parking ticket:', error);
        
        // If it's a permissions error, provide helpful message
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. Please check your Firestore security rules and ensure you are authenticated.');
        }
        
        // Return null on error
        return null;
    }
}

export async function getVehicleById(vehicleId) {
    try {
        console.log('Fetching vehicle by ID:', vehicleId);
        
        const vehicleRef = doc(db, 'vehicles', vehicleId);
        const vehicleSnap = await getDoc(vehicleRef);
        
        if (vehicleSnap.exists()) {
            const vehicleData = {
                id: vehicleSnap.id,
                ...vehicleSnap.data()
            };
            console.log('Found vehicle:', vehicleData);
            return vehicleData;
        } else {
            console.log('No vehicle found with ID:', vehicleId);
            return null;
        }
    } catch (error) {
        console.error('Error fetching vehicle by ID:', error);
        
        // If it's a permissions error, provide helpful message
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. Please check your Firestore security rules and ensure you are authenticated.');
        }
        
        // Return null on error
        return null;
    }
}

// Vehicle Management Functions
export async function addVehicle(userId, vehicleData) {
    try {
        console.log('Adding vehicle for user:', userId, vehicleData);
        
        const vehicleDoc = {
            userId: userId,
            licensePlate: vehicleData.licensePlate,
            vehicleType: vehicleData.vehicleType,
            color: vehicleData.color,
            isActive: true, // New vehicle becomes active by default
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // First, set all existing vehicles to inactive
        await setAllVehiclesInactive(userId);
        
        // Add the new vehicle
        const docRef = await addDoc(collection(db, 'vehicles'), vehicleDoc);
        console.log('Vehicle added with ID:', docRef.id);
        
        return { success: true, vehicleId: docRef.id };
    } catch (error) {
        console.error('Error adding vehicle:', error);
        
        // If it's a permissions error, provide helpful message
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. Please check your Firestore security rules and ensure you are authenticated.');
        }
        
        throw error;
    }
}

export async function getUserVehicles(userId) {
    try {
        console.log('Fetching vehicles for user:', userId);
        
        const vehiclesRef = collection(db, 'vehicles');
        const q = query(vehiclesRef, where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        
        const vehicles = [];
        querySnapshot.forEach((doc) => {
            vehicles.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Found vehicles:', vehicles);
        return vehicles;
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        throw error;
    }
}

export async function setActiveVehicle(userId, vehicleId) {
    try {
        console.log('Setting active vehicle:', vehicleId, 'for user:', userId);
        
        // First, get all user's vehicles
        const vehicles = await getUserVehicles(userId);
        
        // Create a batch to update all vehicles
        const batch = writeBatch(db);
        
        // Set all vehicles to inactive
        vehicles.forEach(vehicle => {
            const vehicleRef = doc(db, 'vehicles', vehicle.id);
            batch.update(vehicleRef, { 
                isActive: false,
                updatedAt: new Date()
            });
        });
        
        // Set the selected vehicle to active
        const activeVehicleRef = doc(db, 'vehicles', vehicleId);
        batch.update(activeVehicleRef, { 
            isActive: true,
            updatedAt: new Date()
        });
        
        // Commit the batch
        await batch.commit();
        console.log('Active vehicle updated successfully');
        
        return { success: true };
    } catch (error) {
        console.error('Error setting active vehicle:', error);
        throw error;
    }
}

async function setAllVehiclesInactive(userId) {
    try {
        const vehicles = await getUserVehicles(userId);
        const batch = writeBatch(db);
        
        vehicles.forEach(vehicle => {
            const vehicleRef = doc(db, 'vehicles', vehicle.id);
            batch.update(vehicleRef, { 
                isActive: false,
                updatedAt: new Date()
            });
        });
        
        if (vehicles.length > 0) {
            await batch.commit();
        }
    } catch (error) {
        console.error('Error setting vehicles inactive:', error);
        throw error;
    }
}

// Legacy functions for parking records
function saveParkingRecord(record) {
    console.log('Saving parking record:', record);
    return new Promise((resolve, reject) => {
        // Simulate database save
        setTimeout(() => {
            resolve({ id: Date.now(), ...record });
        }, 500);
    });
}

function getParkingHistory(userId) {
    console.log('Fetching parking history for user:', userId);
    return new Promise((resolve, reject) => {
        // Simulate database fetch
        setTimeout(() => {
            resolve([
                {
                    id: 1,
                    location: 'Mall Central',
                    startTime: '2024-01-15 10:00',
                    endTime: '2024-01-15 12:00',
                    cost: 15000,
                    status: 'completed'
                },
                {
                    id: 2,
                    location: 'Office Building A',
                    startTime: '2024-01-16 09:00',
                    endTime: '2024-01-16 17:00',
                    cost: 25000,
                    status: 'completed'
                }
            ]);
        }, 500);
    });
}

function updateParkingRecord(recordId, updates) {
    console.log('Updating parking record:', recordId, updates);
    return new Promise((resolve, reject) => {
        // Simulate database update
        setTimeout(() => {
            resolve({ id: recordId, ...updates });
        }, 500);
    });
}

function deleteParkingRecord(recordId) {
    console.log('Deleting parking record:', recordId);
    return new Promise((resolve, reject) => {
        // Simulate database delete
        setTimeout(() => {
            resolve({ success: true, id: recordId });
        }, 500);
    });
}

// End parking session function
export async function endParkingSession(ticketId, durationInSeconds, amount) {
    console.log("=== STARTING endParkingSession ===");
    console.log("Ticket ID:", ticketId);
    console.log("Duration:", durationInSeconds);
    console.log("Amount:", amount);
    
    const db = getFirestore();
    const activeTicketRef = doc(db, "activeParkings", ticketId);
    const historyCollectionRef = collection(db, "parkingHistory");

    try {
        console.log("Starting Firestore transaction...");
        const historyDocId = await runTransaction(db, async (transaction) => {
            console.log("Inside transaction, getting active ticket...");
            // 1. Ambil tiket aktif
            const activeTicketDoc = await transaction.get(activeTicketRef);
            console.log("Active ticket document exists:", activeTicketDoc.exists());
            if (!activeTicketDoc.exists()) {
                throw new Error("Sesi parkir aktif tidak ditemukan! Mungkin sudah berakhir.");
            }
            
            // Check if ticket is still active
            const ticketData = activeTicketDoc.data();
            if (ticketData.status !== 'active') {
                throw new Error("Sesi parkir sudah tidak aktif! Status: " + ticketData.status);
            }
            console.log("Ticket data retrieved:", ticketData);
            console.log("Ticket data keys:", Object.keys(ticketData));

            // 2. GET LOCATION DATA FIRST (all reads must be done before writes)
            console.log("Getting location document for slot restoration...");
            console.log("Location ID from ticket:", ticketData.locationId);
            const locationRef = doc(db, "parkingLocations", ticketData.locationId);
            const locationDoc = await transaction.get(locationRef);
            console.log("Location document exists:", locationDoc.exists());
            // Store location data for later use in writes
            let locationData = null;
            let vehicleType = null;
            let currentAvailable = null;
            
            if (locationDoc.exists()) {
                locationData = locationDoc.data();
                console.log("Location data for slot restoration:", locationData);
                console.log("Ticket data:", ticketData);
                
                // Handle different possible field names for vehicle type
                const vehicleTypeField = ticketData.vehicleType || ticketData.type || ticketData.vehicle_type;
                if (!vehicleTypeField) {
                    throw new Error("Vehicle type field not found in ticket data");
                }
                
                vehicleType = vehicleTypeField.toLowerCase();
                console.log("Restoring slots for vehicle type:", vehicleType);
                console.log("Location slots data:", locationData.slots);
                
                // Check if slots data exists and has the vehicle type
                if (locationData.slots && locationData.slots[vehicleType]) {
                    const currentSlots = locationData.slots[vehicleType];
                    console.log("Current slots for", vehicleType, ":", currentSlots);
                    
                    // Check if currentSlots has the available property
                    if (currentSlots && typeof currentSlots.available !== 'undefined') {
                        currentAvailable = currentSlots.available;
                        console.log("Will increment available slots from", currentAvailable, "to", currentAvailable + 1);
                    } else {
                        console.log("Invalid slot data for", vehicleType, "skipping slot restoration");
                    }
                } else {
                    console.log("No slots data found for vehicle type:", vehicleType, "skipping slot restoration");
                }
            }

            // NOW DO ALL WRITES (after all reads are complete)
            console.log("=== STARTING WRITE OPERATIONS ===");
            
            // 3. Siapkan data untuk riwayat
            console.log("Preparing history data...");
            const historyData = {
                ...ticketData,
                status: "completed",
                endTime: serverTimestamp(),
                duration: durationInSeconds, // <-- Gunakan durasi yang dihitung
                amount: amount              // <-- Gunakan biaya yang dihitung
            };
            console.log("History data prepared:", historyData);
            const newHistoryRef = doc(collection(db, "parkingHistory"));
            console.log("Creating history document...");
            transaction.set(newHistoryRef, historyData);
            console.log("History document created successfully");

            // 4. Hapus tiket aktif
            console.log("Deleting active ticket...");
            transaction.delete(activeTicketRef);
            console.log("Active ticket deleted successfully");

            // 5. Kembalikan slot parkir (if we have valid data)
            if (locationData && vehicleType && currentAvailable !== null) {
                console.log("Updating location slots...");
                transaction.update(locationRef, {
                    [`slots.${vehicleType}.available`]: currentAvailable + 1
                });
                console.log("Location slots updated successfully");
            } else {
                console.log("Skipping slot restoration due to missing data");
            }
            
            console.log("Transaction completed successfully, returning history ID:", newHistoryRef.id);
            return newHistoryRef.id;
        });
        console.log("=== TRANSACTION SUCCESSFUL ===");
        console.log("History document ID:", historyDocId);
        return historyDocId;
    } catch (error) {
        console.error("=== TRANSACTION FAILED ===");
        console.error("Error details:", error);
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

// Get parking history by ID
export async function getParkingHistoryById(historyId) {
    try {
        console.log('Fetching parking history by ID:', historyId);
        
        const db = getFirestore();
        const historyRef = doc(db, 'parkingHistory', historyId);
        const historySnap = await getDoc(historyRef);
        
        if (!historySnap.exists()) {
            console.log('Parking history not found for ID:', historyId);
            return null;
        }
        
        const historyData = {
            id: historySnap.id,
            ...historySnap.data()
        };
        
        console.log('Found parking history:', historyData);
        return historyData;
        
    } catch (error) {
        console.error('Error fetching parking history:', error);
        return null;
    }
}

// Clean up duplicate active tickets
async function cleanupDuplicateActiveTickets(userId, ticketDocs) {
    try {
        console.log('Starting cleanup of duplicate active tickets...');
        
        // Sort tickets by startTime (most recent first)
        const sortedTickets = ticketDocs.sort((a, b) => {
            const aTime = a.data().startTime ? a.data().startTime.toDate() : new Date(0);
            const bTime = b.data().startTime ? b.data().startTime.toDate() : new Date(0);
            return bTime - aTime;
        });
        
        // Keep the most recent ticket, delete the rest
        const ticketsToDelete = sortedTickets.slice(1); // All except the first (most recent)
        
        console.log(`Keeping ticket ${sortedTickets[0].id}, deleting ${ticketsToDelete.length} duplicates`);
        
        // Delete duplicate tickets
        const deletePromises = ticketsToDelete.map(doc => {
            console.log(`Deleting duplicate ticket: ${doc.id}`);
            return deleteDoc(doc.ref);
        });
        
        await Promise.all(deletePromises);
        console.log('Duplicate tickets cleaned up successfully');
        
    } catch (error) {
        console.error('Error cleaning up duplicate tickets:', error);
    }
}

// Get user's parking history
export async function getUserParkingHistory(userId) {
    try {
        console.log('Fetching parking history for user:', userId);
        
        const db = getFirestore();
        const historyRef = collection(db, 'parkingHistory');
        const q = query(historyRef, where('userId', '==', userId), where('status', '==', 'completed'));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            console.log('No parking history found for user:', userId);
            return [];
        }
        
        const historyData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Sort by endTime descending (most recent first)
        historyData.sort((a, b) => {
            const aTime = a.endTime ? a.endTime.toDate() : new Date(0);
            const bTime = b.endTime ? b.endTime.toDate() : new Date(0);
            return bTime - aTime;
        });
        
        console.log('Found parking history for user:', historyData.length, 'transactions');
        return historyData;
        
    } catch (error) {
        console.error('Error fetching user parking history:', error);
        return [];
    }
}

// Notification history functions
export async function saveNotification(userId, notificationData) {
    try {
        console.log('Saving notification for user:', userId);
        console.log('Notification data:', notificationData);
        
        const db = getFirestore();
        const notificationsRef = collection(db, 'notifications');
        
        const notificationDoc = {
            userId: userId,
            type: notificationData.type, // 'parking_start', 'parking_end', 'payment_success', 'payment_failed'
            title: notificationData.title,
            message: notificationData.message,
            locationName: notificationData.locationName || null,
            vehicleInfo: notificationData.vehicleInfo || null,
            amount: notificationData.amount || null,
            duration: notificationData.duration || null,
            isRead: false,
            createdAt: serverTimestamp()
        };
        
        const docRef = await addDoc(notificationsRef, notificationDoc);
        console.log('Notification saved with ID:', docRef.id);
        return docRef.id;
        
    } catch (error) {
        console.error('Error saving notification:', error);
        throw error;
    }
}

export async function getUserNotifications(userId, filter = 'all') {
    try {
        console.log('Fetching notifications for user:', userId, 'Filter:', filter);
        
        const db = getFirestore();
        const notificationsRef = collection(db, 'notifications');
        let q;
        
        if (filter === 'unread') {
            q = query(notificationsRef, where('userId', '==', userId), where('isRead', '==', false));
        } else {
            q = query(notificationsRef, where('userId', '==', userId));
        }
        
        const querySnapshot = await getDocs(q);
        
        const notifications = [];
        querySnapshot.forEach((doc) => {
            notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by createdAt descending (most recent first)
        notifications.sort((a, b) => {
            const aTime = a.createdAt ? a.createdAt.toDate() : new Date(0);
            const bTime = b.createdAt ? b.createdAt.toDate() : new Date(0);
            return bTime - aTime;
        });
        
        console.log('Notifications fetched:', notifications.length, 'records');
        return notifications;
        
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}

export async function markNotificationAsRead(notificationId) {
    try {
        console.log('Marking notification as read:', notificationId);
        
        const db = getFirestore();
        const notificationRef = doc(db, 'notifications', notificationId);
        
        await updateDoc(notificationRef, {
            isRead: true,
            readAt: serverTimestamp()
        });
        
        console.log('Notification marked as read');
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}

// Real-time listeners
function listenToParkingUpdates(userId, callback) {
    console.log('Setting up real-time listener for user:', userId);
    // Add your real-time listener code here
}

// Export functions
window.Firestore = {
    saveParkingRecord,
    getParkingHistory,
    updateParkingRecord,
    deleteParkingRecord,
    listenToParkingUpdates
};
