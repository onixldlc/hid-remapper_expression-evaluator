function showPopup(title, message, type, duration=3000) {
    const popupContainer = document.getElementById('popup');
    const box = document.createElement('div');

    // Determine background color based on the type
    let bgColor = "bg-gray-800";
    switch (type) {
        case "success":
            bgColor = "bg-green-600";
            break;
        case "error":
            bgColor = "bg-red-600";
            break;
        case "warning":
            bgColor = "bg-yellow-600";
            break;
        case "info":
            bgColor = "bg-blue-600";
            break;
    }

    // Setup the box with Tailwind classes for background, padding, rounded corners, and transitions
    box.className = `fixed bottom-4 right-4 ${bgColor} text-white p-4 rounded-lg shadow-lg transform translate-x-10 opacity-0 transition-all duration-500 w-[300px]`;

    // Create a header for the title
    const header = document.createElement('div');
    header.className = "font-semibold mb-2";
    header.textContent = title;

    // Create a paragraph for the message text
    const text = document.createElement('div');
    text.textContent = message;

    // Append the header and text to the popup box
    box.appendChild(header);
    box.appendChild(text);

    popupContainer.appendChild(box);

    // Force reflow to ensure the transition will work
    void box.offsetWidth;

    // Slide in the box
    box.classList.remove("translate-x-10", "opacity-0");

    // Automatically hide the popup after 3 seconds with a slide-out animation
    setTimeout(() => {
        box.classList.add("translate-x-10", "opacity-0");
        setTimeout(() => {
            popupContainer.removeChild(box);
        }, 500);
    }, duration);
}