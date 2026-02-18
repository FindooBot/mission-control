/**
 * Calendar Service
 * Fetches and parses iCal feeds
 */

const axios = require('axios');
const ical = require('node-ical');

class CalendarService {
  constructor() {
    this.calendars = new Map();
  }

  /**
   * Add a calendar configuration
   */
  addCalendar(type, url) {
    if (url && url.trim()) {
      this.calendars.set(type, url.trim());
    }
  }

  /**
   * Fetch and parse an iCal feed
   */
  async fetchCalendar(url) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        responseType: 'text',
        headers: {
          'User-Agent': 'Mission-Control-Calendar/1.0'
        }
      });

      const parsed = ical.parseICS(response.data);
      const events = [];

      for (const key in parsed) {
        const event = parsed[key];
        if (event.type === 'VEVENT') {
          events.push(this.formatEvent(event));
        }
      }

      return events;
    } catch (error) {
      console.error('Failed to fetch calendar:', error.message);
      return [];
    }
  }

  /**
   * Get all events from all configured calendars
   */
  async getAllEvents() {
    const allEvents = [];

    for (const [type, url] of this.calendars) {
      const events = await this.fetchCalendar(url);
      events.forEach(event => {
        event.calendar_type = type;
        allEvents.push(event);
      });
    }

    // Sort by start time
    return allEvents.sort((a, b) => 
      new Date(a.start_time) - new Date(b.start_time)
    );
  }

  /**
   * Get events for today
   */
  async getTodayEvents(calendarType = null) {
    const allEvents = calendarType 
      ? await this.fetchCalendar(this.calendars.get(calendarType))
      : await this.getAllEvents();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return allEvents.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = event.end_time ? new Date(event.end_time) : null;

      // Event starts today
      const startsToday = eventStart >= today && eventStart < tomorrow;
      
      // Event is ongoing (started before today, ends today or later)
      const isOngoing = eventStart < today && eventEnd && eventEnd >= today;

      return startsToday || isOngoing;
    });
  }

  /**
   * Get events for a specific date range
   */
  async getEventsInRange(startDate, endDate, calendarType = null) {
    const allEvents = calendarType 
      ? await this.fetchCalendar(this.calendars.get(calendarType))
      : await this.getAllEvents();

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return allEvents.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = event.end_time ? new Date(event.end_time) : eventStart;

      // Event overlaps with range
      return eventStart <= end && eventEnd >= start;
    });
  }

  /**
   * Format iCal event to database format
   */
  formatEvent(event) {
    const uid = event.uid || `${event.summary}-${event.start}`;
    
    return {
      uid: uid,
      summary: event.summary || 'Untitled Event',
      description: event.description || '',
      start_time: this.parseDate(event.start),
      end_time: event.end ? this.parseDate(event.end) : null,
      location: event.location || '',
      calendar_type: 'personal' // Will be set by caller
    };
  }

  /**
   * Parse various date formats from node-ical
   */
  parseDate(dateValue) {
    if (!dateValue) return null;
    
    // Handle Date object
    if (dateValue instanceof Date) {
      return dateValue.toISOString();
    }
    
    // Handle ical date object with getTime method
    if (typeof dateValue === 'object' && dateValue.getTime) {
      return new Date(dateValue.getTime()).toISOString();
    }
    
    // Handle string
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toISOString();
    }
    
    return null;
  }

  /**
   * Format time for display (e.g., "2:30 PM")
   */
  formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Format duration for display (e.g., "1h 30m")
   */
  formatDuration(startTime, endTime) {
    if (!endTime) return 'All day';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  /**
   * Check if event is all-day
   */
  isAllDay(startTime, endTime) {
    if (!endTime) return true;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // If duration is exactly 24 hours or more and times are midnight
    const diffHours = (end - start) / (1000 * 60 * 60);
    return diffHours >= 24 || (start.getHours() === 0 && start.getMinutes() === 0);
  }
}

module.exports = CalendarService;
