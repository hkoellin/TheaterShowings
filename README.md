# NYC Theater Showtimes

A Next.js web application that aggregates film showtimes from five independent NYC theaters into a single, unified interface.

## Features

- **Multi-Theater Aggregation**: Scrapes showtimes from 5 independent NYC cinemas
- **Modern UI**: Clean, responsive interface with dark mode support
- **Smart Filtering**: Filter by theater and date (today, tomorrow, this week, or custom)
- **Direct Ticketing**: Buy tickets directly from each theater's website
- **Resilient Design**: Continues to work even if individual theater sites are down

## Supported Theaters

| Theater | Location | Website |
|---------|----------|---------|
| **Metrograph** | Lower East Side, Manhattan | https://metrograph.com/now-showing |
| **BAM Rose Cinemas** | Fort Greene, Brooklyn | https://www.bam.org/film |
| **Low Cinema** | Ridgewood, Queens | https://lowcinema.com/calendar |
| **IFC Center** | Greenwich Village, Manhattan | https://www.ifccenter.com |
| **Film Forum** | West Houston St, Manhattan | https://filmforum.org/now_playing |

## Installation

1. Clone the repository:
```bash
git clone https://github.com/hkoellin/TheaterShowings.git
cd TheaterShowings
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Development
```bash
npm run dev    # Start development server
npm run build  # Build for production
npm run start  # Start production server
npm run lint   # Run ESLint
```

## How It Works

### Architecture

The application is built with Next.js 14+ using the App Router and consists of three main layers:

#### 1. Scrapers (`/scrapers`)
Each theater has its own scraper module that:
- Fetches the theater's showtimes page using native fetch
- Parses HTML with Cheerio to extract film information
- Returns standardized `Showtime` objects
- Handles errors gracefully (failed scrapers don't break the app)

**Key Files:**
- `scrapers/metrograph.ts` - Metrograph scraper
- `scrapers/bam.ts` - BAM Rose Cinemas scraper
- `scrapers/lowcinema.ts` - Low Cinema scraper
- `scrapers/ifc.ts` - IFC Center scraper
- `scrapers/filmforum.ts` - Film Forum scraper
- `scrapers/index.ts` - Aggregates all scrapers

#### 2. API Route (`/app/api/showtimes`)
- Calls all scrapers concurrently using `Promise.allSettled()`
- Returns aggregated showtimes as JSON
- Includes 1-hour cache headers for performance
- Returns partial results if some scrapers fail

#### 3. Frontend (`/app`, `/components`)
- Modern React components with TypeScript
- Real-time filtering by theater and date
- Responsive design (mobile and desktop)
- Dark mode support (follows system preference)
- Loading, error, and empty states

### Data Model

```typescript
interface Showtime {
  id: string;          // Unique identifier
  film: string;        // Film title
  theater: string;     // Theater name
  date: string;        // ISO date (YYYY-MM-DD)
  time: string;        // e.g., "7:30 PM"
  ticketUrl: string;   // Direct link to tickets
  imageUrl?: string;   // Film poster (optional)
  description?: string; // Synopsis (optional)
}
```

## Important Notes

### Web Scraping Limitations

⚠️ **This app uses web scraping, not official APIs.** Theater websites may change their HTML structure at any time, which can break the scrapers.

**What this means:**
- Scrapers may need periodic updates
- Some theaters may temporarily show no showtimes if their site changes
- Each scraper is independent, so one failure doesn't affect others

**Maintenance:**
- Each scraper has clear comments explaining what HTML elements it targets
- Selectors are designed to be flexible and work with common patterns
- Failed scrapers are logged to the console for debugging

### Theater Website Changes

If a scraper stops working:
1. Check the theater's website to see if the structure changed
2. Open the relevant scraper file (e.g., `scrapers/metrograph.ts`)
3. Update the CSS selectors to match the new HTML structure
4. Test locally with `npm run dev`

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Deploy with one click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Other Platforms

This is a standard Next.js app and can be deployed to:
- Netlify
- AWS (Amplify, EC2)
- Digital Ocean
- Any Node.js hosting platform

## Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Scraping**: Cheerio for HTML parsing
- **HTTP**: Native fetch API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Adding a New Theater

1. Create a new scraper in `/scrapers/[theater-name].ts`
2. Export a scrape function that returns `Showtime[]`
3. Add it to `scrapers/index.ts`
4. Add the theater name to `types/showtime.ts`
5. Test thoroughly

## License

ISC

## Acknowledgments

Built for NYC film lovers who want to discover independent cinema across the city.
