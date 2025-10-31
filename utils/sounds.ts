// A shared place for Web Audio API functions to avoid code duplication.

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
    if (!audioContext) {
        try {
            // Standard and webkit-prefixed AudioContext for browser compatibility.
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch(e) {
            console.error("Web Audio API is not supported in this browser.");
        }
    }
    return audioContext;
};

/**
 * Plays a short, sharp click sound.
 * Ideal for general UI feedback like dragging timeline blocks.
 */
export const playClickSound = () => {
    try {
        const context = getAudioContext();
        if (!context) return;
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, context.currentTime);
        gainNode.gain.setValueAtTime(0.5, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.05);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.05);
    } catch (error) {
        console.error("Could not play sound", error);
    }
};

/**
 * Plays a softer, lower-pitched tick sound.
 * Designed for the calendar drag-over effect to be less intrusive.
 */
export const playCalendarTickSound = () => {
     try {
        const context = getAudioContext();
        if (!context) return;
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'triangle'; // A softer waveform than 'sine'
        oscillator.frequency.setValueAtTime(600, context.currentTime);
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.08);
    } catch (error) {
        console.error("Could not play sound", error);
    }
};
