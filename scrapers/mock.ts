import { Showtime } from '@/types/showtime';

/**
 * Mock scraper for demonstration purposes
 * 
 * Returns sample showtimes across the current week to demonstrate the calendar UI.
 * Remove or disable this in production when actual scrapers are working.
 */
export async function scrapeMock(): Promise<Showtime[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  const today = new Date();
  
  // Get start of current week (Sunday)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const dayOffset = (offset: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + offset);
    return formatDate(d);
  };

  return [
    // Sunday
    {
      id: 'mock-metrograph-sun-1',
      film: 'The Substance',
      theater: 'Metrograph',
      date: dayOffset(0),
      time: '2:00 PM',
      ticketUrl: 'https://metrograph.com',
      imageUrl: 'https://via.placeholder.com/300x450/4A90E2/FFFFFF?text=The+Substance',
      description: 'A fading celebrity decides to use a black market drug to create a younger version of herself.'
    },
    {
      id: 'mock-filmforum-sun-1',
      film: 'Anatomy of a Fall',
      theater: 'Film Forum',
      date: dayOffset(0),
      time: '5:00 PM',
      ticketUrl: 'https://filmforum.org/now_playing',
      imageUrl: 'https://via.placeholder.com/300x450/F39C12/FFFFFF?text=Anatomy+of+a+Fall',
      description: 'A woman is suspected of her husband\'s death, and their blind son faces a moral dilemma as the sole witness.'
    },
    // Monday
    {
      id: 'mock-bam-mon-1',
      film: 'All of Us Strangers',
      theater: 'BAM Rose Cinemas',
      date: dayOffset(1),
      time: '6:00 PM',
      ticketUrl: 'https://www.bam.org/film',
      imageUrl: 'https://via.placeholder.com/300x450/9B59B6/FFFFFF?text=All+of+Us+Strangers',
      description: 'A screenwriter drawn back to his childhood home encounters mysterious parents who appear as they were when he was a child.'
    },
    {
      id: 'mock-ifc-mon-1',
      film: 'Drive-Away Dolls',
      theater: 'IFC Center',
      date: dayOffset(1),
      time: '7:30 PM',
      ticketUrl: 'https://www.ifccenter.com',
      imageUrl: 'https://via.placeholder.com/300x450/E74C3C/FFFFFF?text=Drive-Away+Dolls',
      description: 'Two friends embark on a road trip to Tallahassee, but things quickly go awry when they cross paths with a group of criminals.'
    },
    {
      id: 'mock-metrograph-mon-1',
      film: 'The Substance',
      theater: 'Metrograph',
      date: dayOffset(1),
      time: '9:45 PM',
      ticketUrl: 'https://metrograph.com',
      imageUrl: 'https://via.placeholder.com/300x450/4A90E2/FFFFFF?text=The+Substance',
      description: 'A fading celebrity decides to use a black market drug to create a younger version of herself.'
    },
    // Tuesday
    {
      id: 'mock-low-tue-1',
      film: 'Perfect Days',
      theater: 'Low Cinema',
      date: dayOffset(2),
      time: '7:00 PM',
      ticketUrl: 'https://lowcinema.com/calendar',
      imageUrl: 'https://via.placeholder.com/300x450/27AE60/FFFFFF?text=Perfect+Days',
      description: 'A toilet cleaner in Tokyo leads a simple life, finding beauty in everyday moments through his routines.'
    },
    {
      id: 'mock-filmforum-tue-1',
      film: 'The Zone of Interest',
      theater: 'Film Forum',
      date: dayOffset(2),
      time: '8:15 PM',
      ticketUrl: 'https://filmforum.org/now_playing',
      imageUrl: 'https://via.placeholder.com/300x450/F39C12/FFFFFF?text=The+Zone+of+Interest',
      description: 'The commandant of Auschwitz and his wife strive to build a dream life for their family in a house next to the camp.'
    },
    // Wednesday
    {
      id: 'mock-metrograph-wed-1',
      film: 'The Substance',
      theater: 'Metrograph',
      date: dayOffset(3),
      time: '4:00 PM',
      ticketUrl: 'https://metrograph.com',
      imageUrl: 'https://via.placeholder.com/300x450/4A90E2/FFFFFF?text=The+Substance',
      description: 'A fading celebrity decides to use a black market drug to create a younger version of herself.'
    },
    {
      id: 'mock-bam-wed-1',
      film: 'Past Lives',
      theater: 'BAM Rose Cinemas',
      date: dayOffset(3),
      time: '7:15 PM',
      ticketUrl: 'https://www.bam.org/film',
      imageUrl: 'https://via.placeholder.com/300x450/9B59B6/FFFFFF?text=Past+Lives',
      description: 'Nora and Hae Sung, two deeply connected childhood friends, are wrested apart after Nora\'s family emigrates from South Korea.'
    },
    {
      id: 'mock-ifc-wed-1',
      film: 'Aftersun',
      theater: 'IFC Center',
      date: dayOffset(3),
      time: '9:00 PM',
      ticketUrl: 'https://www.ifccenter.com',
      imageUrl: 'https://via.placeholder.com/300x450/E74C3C/FFFFFF?text=Aftersun',
      description: 'At a fading vacation resort, 11-year-old Sophie treasures rare time together with her loving and idealistic father.'
    },
    // Thursday
    {
      id: 'mock-low-thu-1',
      film: 'Perfect Days',
      theater: 'Low Cinema',
      date: dayOffset(4),
      time: '6:30 PM',
      ticketUrl: 'https://lowcinema.com/calendar',
      imageUrl: 'https://via.placeholder.com/300x450/27AE60/FFFFFF?text=Perfect+Days',
      description: 'A toilet cleaner in Tokyo leads a simple life, finding beauty in everyday moments through his routines.'
    },
    {
      id: 'mock-filmforum-thu-1',
      film: 'Anatomy of a Fall',
      theater: 'Film Forum',
      date: dayOffset(4),
      time: '7:00 PM',
      ticketUrl: 'https://filmforum.org/now_playing',
      imageUrl: 'https://via.placeholder.com/300x450/F39C12/FFFFFF?text=Anatomy+of+a+Fall',
      description: 'A woman is suspected of her husband\'s death, and their blind son faces a moral dilemma as the sole witness.'
    },
    // Friday
    {
      id: 'mock-metrograph-fri-1',
      film: 'The Substance',
      theater: 'Metrograph',
      date: dayOffset(5),
      time: '5:00 PM',
      ticketUrl: 'https://metrograph.com',
      imageUrl: 'https://via.placeholder.com/300x450/4A90E2/FFFFFF?text=The+Substance',
      description: 'A fading celebrity decides to use a black market drug to create a younger version of herself.'
    },
    {
      id: 'mock-bam-fri-1',
      film: 'All of Us Strangers',
      theater: 'BAM Rose Cinemas',
      date: dayOffset(5),
      time: '7:00 PM',
      ticketUrl: 'https://www.bam.org/film',
      imageUrl: 'https://via.placeholder.com/300x450/9B59B6/FFFFFF?text=All+of+Us+Strangers',
      description: 'A screenwriter drawn back to his childhood home encounters mysterious parents who appear as they were when he was a child.'
    },
    {
      id: 'mock-ifc-fri-1',
      film: 'Drive-Away Dolls',
      theater: 'IFC Center',
      date: dayOffset(5),
      time: '8:30 PM',
      ticketUrl: 'https://www.ifccenter.com',
      imageUrl: 'https://via.placeholder.com/300x450/E74C3C/FFFFFF?text=Drive-Away+Dolls',
      description: 'Two friends embark on a road trip to Tallahassee, but things quickly go awry when they cross paths with a group of criminals.'
    },
    {
      id: 'mock-filmforum-fri-1',
      film: 'The Zone of Interest',
      theater: 'Film Forum',
      date: dayOffset(5),
      time: '10:00 PM',
      ticketUrl: 'https://filmforum.org/now_playing',
      imageUrl: 'https://via.placeholder.com/300x450/F39C12/FFFFFF?text=The+Zone+of+Interest',
      description: 'The commandant of Auschwitz and his wife strive to build a dream life for their family in a house next to the camp.'
    },
    // Saturday
    {
      id: 'mock-low-sat-1',
      film: 'Perfect Days',
      theater: 'Low Cinema',
      date: dayOffset(6),
      time: '3:00 PM',
      ticketUrl: 'https://lowcinema.com/calendar',
      imageUrl: 'https://via.placeholder.com/300x450/27AE60/FFFFFF?text=Perfect+Days',
      description: 'A toilet cleaner in Tokyo leads a simple life, finding beauty in everyday moments through his routines.'
    },
    {
      id: 'mock-metrograph-sat-1',
      film: 'The Substance',
      theater: 'Metrograph',
      date: dayOffset(6),
      time: '6:00 PM',
      ticketUrl: 'https://metrograph.com',
      imageUrl: 'https://via.placeholder.com/300x450/4A90E2/FFFFFF?text=The+Substance',
      description: 'A fading celebrity decides to use a black market drug to create a younger version of herself.'
    },
    {
      id: 'mock-bam-sat-1',
      film: 'Past Lives',
      theater: 'BAM Rose Cinemas',
      date: dayOffset(6),
      time: '7:30 PM',
      ticketUrl: 'https://www.bam.org/film',
      imageUrl: 'https://via.placeholder.com/300x450/9B59B6/FFFFFF?text=Past+Lives',
      description: 'Nora and Hae Sung, two deeply connected childhood friends, are wrested apart after Nora\'s family emigrates from South Korea.'
    },
    {
      id: 'mock-ifc-sat-1',
      film: 'Aftersun',
      theater: 'IFC Center',
      date: dayOffset(6),
      time: '9:15 PM',
      ticketUrl: 'https://www.ifccenter.com',
      imageUrl: 'https://via.placeholder.com/300x450/E74C3C/FFFFFF?text=Aftersun',
      description: 'At a fading vacation resort, 11-year-old Sophie treasures rare time together with her loving and idealistic father.'
    },
  ];
}
