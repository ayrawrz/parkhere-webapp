// UI utility functions for ParkHere web app
console.log('ParkHere ui.js loaded');

// SweetAlert2 is loaded via CDN script tag in HTML 

// Show toast notification
export function showToast(icon, title) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    Toast.fire({
        icon: icon,
        title: title
    });
}

// Show popup with callback
export function showPopup(icon, title, text, callback) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        confirmButtonText: 'OK'
    }).then((result) => {
        if (result.isConfirmed && callback) {
            callback();
        }
    });
}

// Helper function to parse Firebase error messages
export function parseFirebaseError(error) {
    const errorMessages = {
        'auth/wrong-password': 'Wrong password',
        'auth/user-not-found': 'User not found',
        'auth/email-already-in-use': 'Email already in use',
        'auth/weak-password': 'Password is too weak',
        'auth/invalid-email': 'Invalid email address',
        'auth/user-disabled': 'This account has been disabled',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later',
        'auth/network-request-failed': 'Network error. Please check your connection',
        'auth/popup-closed-by-user': 'Sign-in popup was closed',
        'auth/cancelled-popup-request': 'Sign-in was cancelled'
    };
    
    // Extract the error code from the error message
    const errorCode = error.message.match(/\(auth\/[^)]+\)/)?.[0]?.slice(1, -1);
    
    // Return user-friendly message or fallback to original message
    return errorMessages[errorCode] || error.message.replace(/^Firebase: Error \(auth\/[^)]+\)\.\s*/, '');
}

// Notification system
export function showNotification(title, message, type = 'info', duration = 5000) {
    console.log('=== SHOWING NOTIFICATION ===');
    console.log('Title:', title);
    console.log('Message:', message);
    console.log('Type:', type);
    console.log('Duration:', duration);
    
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        console.log('Creating notification container...');
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(notificationContainer);
        console.log('Notification container created and added to body');
    } else {
        console.log('Notification container already exists');
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        background-color: #2C2C2C;
        border: 1px solid #3C3C3C;
        border-radius: 12px;
        padding: 16px 20px;
        min-width: 300px;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        position: relative;
        overflow: hidden;
        margin-bottom: 10px;
    `;
    
    console.log('Notification element created with styles:', notification.style.cssText);
    
    // Add colored border based on type
    const borderColor = {
        'success': '#10B981',
        'error': '#EF4444',
        'warning': '#F59E0B',
        'info': '#3B82F6'
    }[type] || '#3C3C3C';
    
    notification.style.borderLeft = `4px solid ${borderColor}`;
    
    // Create notification content
    notification.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div class="notification-icon" style="
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background-color: ${borderColor};
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin-top: 2px;
            ">
                <i class="ph ph-${getNotificationIcon(type)}" style="
                    font-size: 12px;
                    color: white;
                "></i>
            </div>
            <div style="flex: 1;">
                <div style="
                    color: #FFFFFF;
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 4px;
                ">${title}</div>
                <div style="
                    color: #A0A0A0;
                    font-size: 13px;
                    line-height: 1.4;
                ">${message}</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: none;
                border: none;
                color: #A0A0A0;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: color 0.2s ease;
            " onmouseover="this.style.color='#FFFFFF'" onmouseout="this.style.color='#A0A0A0'">
                <i class="ph ph-x" style="font-size: 16px;"></i>
            </button>
        </div>
    `;
    
    // Add to container
    console.log('Adding notification to container...');
    notificationContainer.appendChild(notification);
    console.log('Notification added to container. Container children count:', notificationContainer.children.length);
    
    // Animate in
    setTimeout(() => {
        console.log('Animating notification in...');
        notification.style.transform = 'translateX(0)';
        console.log('Notification should now be visible');
    }, 100);
    
    // Auto remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
    
    return notification;
}

// Get notification icon based on type
function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'x-circle',
        'warning': 'warning-circle',
        'info': 'info'
    };
    return icons[type] || 'info';
}

// Parking-specific notifications
export function showParkingStartNotification(locationName, vehicleInfo) {
    console.log('=== SHOWING PARKING START NOTIFICATION ===');
    console.log('Location:', locationName);
    console.log('Vehicle Info:', vehicleInfo);
    
    return showNotification(
        'Parking Started',
        `Your parking session at ${locationName} has started. Vehicle: ${vehicleInfo}`,
        'success',
        6000
    );
}

export function showParkingEndNotification(locationName, duration, amount) {
    return showNotification(
        'Parking Ended',
        `Your parking session at ${locationName} has ended. Duration: ${duration}, Amount: Rp ${amount.toLocaleString()}`,
        'info',
        6000
    );
}

export function showPaymentSuccessNotification(amount) {
    return showNotification(
        'Payment Successful',
        `Your payment of Rp ${amount.toLocaleString()} has been processed successfully.`,
        'success',
        5000
    );
}

export function showPaymentFailedNotification() {
    return showNotification(
        'Payment Failed',
        'Your payment could not be processed. Please try again.',
        'error',
        5000
    );
}
