import { Showtime } from '@/types/showtime';

/**
 * Mock scraper for demonstration purposes
 * 
 * Returns sample showtimes to demonstrate the UI when real scrapers can't be accessed.
 * Remove or disable this in production when actual scrapers are working.
 */
export async function scrapeMock(): Promise<Showtime[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  return [
    {
      id: 'mock-metrograph-1',
      film: 'The Substance',
      theater: 'Metrograph',
      date: formatDate(today),
      time: '7:30 PM',
      ticketUrl: 'https://metrograph.com',
      imageUrl: 'https://via.placeholder.com/300x450/4A90E2/FFFFFF?text=The+Substance',
      description: 'A fading celebrity decides to use a black market drug to create a younger version of herself.'
    },
    {
      id: 'mock-metrograph-2',
      film: 'The Substance',
      theater: 'Metrograph',
      date: formatDate(today),
      time: '9:45 PM',
      ticketUrl: 'https://metrograph.com',
      imageUrl: 'https://via.placeholder.com/300x450/4A90E2/FFFFFF?text=The+Substance',
      description: 'A fading celebrity decides to use a black market drug to create a younger version of herself.'
    },
    {
      id: 'mock-bam-1',
      film: 'All of Us Strangers',
      theater: 'BAM Rose Cinemas',
      date: formatDate(today),
      time: '6:00 PM',
      ticketUrl: 'https://www.bam.org/film',
      imageUrl: 'https://via.placeholder.com/300x450/9B59B6/FFFFFF?text=All+of+Us+Strangers',
      description: 'A screenwriter drawn back to his childhood home encounters mysterious parents who appear as they were when he was a child.'
    },
    {
      id: 'mock-bam-2',
      film: 'Past Lives',
      theater: 'BAM Rose Cinemas',
      date: formatDate(tomorrow),
      time: '7:15 PM',
      ticketUrl: 'https://www.bam.org/film',
      imageUrl: 'https://via.placeholder.com/300x450/9B59B6/FFFFFF?text=Past+Lives',
      description: 'Nora and Hae Sung, two deeply connected childhood friends, are wrested apart after Nora\'s family emigrates from South Korea.'
    },
    {
      id: 'mock-low-1',
      film: 'Perfect Days',
      theater: 'Low Cinema',
      date: formatDate(today),
      time: '8:00 PM',
      ticketUrl: 'https://lowcinema.com/calendar',
      imageUrl: 'https://via.placeholder.com/300x450/27AE60/FFFFFF?text=Perfect+Days',
      description: 'A toilet cleaner in Tokyo leads a simple life, finding beauty in everyday moments through his routines.'
    },
    {
      id: 'mock-ifc-1',
      film: 'Drive-Away Dolls',
      theater: 'IFC Center',
      date: formatDate(today),
      time: '5:30 PM',
      ticketUrl: 'https://www.ifccenter.com',
      imageUrl: 'https://via.placeholder.com/300x450/E74C3C/FFFFFF?text=Drive-Away+Dolls',
      description: 'Two friends embark on a road trip to Tallahassee, but things quickly go awry when they cross paths with a group of criminals.'
    },
    {
      id: 'mock-ifc-2',
      film: 'Aftersun',
      theater: 'IFC Center',
      date: formatDate(tomorrow),
      time: '6:30 PM',
      ticketUrl: 'https://www.ifccenter.com',
      imageUrl: 'https://via.placeholder.com/300x450/E74C3C/FFFFFF?text=Aftersun',
      description: 'At a fading vacation resort, 11-year-old Sophie treasures rare time together with her loving and idealistic father.'
    },
    {
      id: 'mock-filmforum-1',
      film: 'Anatomy of a Fall',
      theater: 'Film Forum',
      date: formatDate(today),
      time: '7:00 PM',
      ticketUrl: 'https://filmforum.org/now_playing',
      imageUrl: 'https://via.placeholder.com/300x450/F39C12/FFFFFF?text=Anatomy+of+a+Fall',
      description: 'A woman is suspected of her husband\'s death, and their blind son faces a moral dilemma as the sole witness.'
    },
    {
      id: 'mock-filmforum-2',
      film: 'The Zone of Interest',
      theater: 'Film Forum',
      date: formatDate(tomorrow),
      time: '8:15 PM',
      ticketUrl: 'https://filmforum.org/now_playing',
      imageUrl: 'https://via.placeholder.com/300x450/F39C12/FFFFFF?text=The+Zone+of+Interest',
      description: 'The commandant of Auschwitz and his wife strive to build a dream life for their family in a house next to the camp.'
    },
  ];
}
