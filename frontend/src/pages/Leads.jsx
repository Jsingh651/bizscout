import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import { useAuth } from '../context/AuthContext'
import {
  Search, MapPin, AlertTriangle, ExternalLink, Zap, BarChart2,
  Users, Target, ArrowUpRight, CheckCircle2, Circle, X, CheckCheck,
  Square, Globe, PhoneCall, ArrowRight, AlertCircle, Layers,
  ChevronDown, ChevronRight, Star,
} from 'lucide-react'
import NavbarDropdown from '../components/NavbarDropdown'

const API = 'http://127.0.0.1:8000'

// ─── Large city list ──────────────────────────────────────────────────────────

const CITIES_RAW = [
  // California
  'Los Angeles, CA','San Diego, CA','San Jose, CA','San Francisco, CA',
  'Fresno, CA','Sacramento, CA','Long Beach, CA','Oakland, CA','Bakersfield, CA',
  'Anaheim, CA','Santa Ana, CA','Riverside, CA','Stockton, CA','Irvine, CA',
  'Chula Vista, CA','Fremont, CA','San Bernardino, CA','Modesto, CA','Fontana, CA',
  'Moreno Valley, CA','Glendale, CA','Huntington Beach, CA','Santa Clarita, CA',
  'Garden Grove, CA','Oceanside, CA','Rancho Cucamonga, CA','Santa Rosa, CA',
  'Ontario, CA','Elk Grove, CA','Roseville, CA','Oxnard, CA','Corona, CA',
  'Lancaster, CA','Palmdale, CA','Salinas, CA','Hayward, CA','Pomona, CA',
  'Sunnyvale, CA','Escondido, CA','Torrance, CA','Pasadena, CA','Orange, CA',
  'Fullerton, CA','Thousand Oaks, CA','Visalia, CA','Simi Valley, CA',
  'Concord, CA','Roseville, CA','Santa Clara, CA','Victorville, CA',
  // Texas
  'Houston, TX','San Antonio, TX','Dallas, TX','Austin, TX','Fort Worth, TX',
  'El Paso, TX','Arlington, TX','Corpus Christi, TX','Plano, TX','Laredo, TX',
  'Lubbock, TX','Garland, TX','Irving, TX','Amarillo, TX','Grand Prairie, TX',
  'McKinney, TX','Frisco, TX','Brownsville, TX','Pasadena, TX','Killeen, TX',
  'McAllen, TX','Mesquite, TX','Waco, TX','Carrollton, TX','Denton, TX',
  'Midland, TX','Lewisville, TX','Abilene, TX','Tyler, TX','Pearland, TX',
  'College Station, TX','Beaumont, TX','Round Rock, TX','Odessa, TX','Wichita Falls, TX',
  // Florida
  'Jacksonville, FL','Miami, FL','Tampa, FL','Orlando, FL','St. Petersburg, FL',
  'Hialeah, FL','Port St. Lucie, FL','Cape Coral, FL','Tallahassee, FL',
  'Fort Lauderdale, FL','Pembroke Pines, FL','Hollywood, FL','Miramar, FL',
  'Gainesville, FL','Coral Springs, FL','Clearwater, FL','Palm Bay, FL',
  'Pompano Beach, FL','West Palm Beach, FL','Lakeland, FL','Davie, FL',
  'Boca Raton, FL','Deltona, FL','Sunrise, FL','Plantation, FL','Fort Myers, FL',
  'Melbourne, FL','Alafaya, FL','Deerfield Beach, FL','Palm Coast, FL',
  // New York
  'New York City, NY','Buffalo, NY','Rochester, NY','Yonkers, NY','Syracuse, NY',
  'Albany, NY','New Rochelle, NY','Mount Vernon, NY','Schenectady, NY','Utica, NY',
  'Brooklyn, NY','Queens, NY','Manhattan, NY','Staten Island, NY','The Bronx, NY',
  // Illinois
  'Chicago, IL','Aurora, IL','Joliet, IL','Naperville, IL','Rockford, IL',
  'Springfield, IL','Elgin, IL','Peoria, IL','Champaign, IL','Waukegan, IL',
  // Pennsylvania
  'Philadelphia, PA','Pittsburgh, PA','Allentown, PA','Erie, PA','Reading, PA',
  'Scranton, PA','Bethlehem, PA','Lancaster, PA','Harrisburg, PA','York, PA',
  // Ohio
  'Columbus, OH','Cleveland, OH','Cincinnati, OH','Toledo, OH','Akron, OH',
  'Dayton, OH','Parma, OH','Canton, OH','Youngstown, OH','Lorain, OH',
  // Georgia
  'Atlanta, GA','Columbus, GA','Savannah, GA','Augusta, GA','Athens, GA',
  'Sandy Springs, GA','Roswell, GA','Macon, GA','Johns Creek, GA','Albany, GA',
  // North Carolina
  'Charlotte, NC','Raleigh, NC','Greensboro, NC','Durham, NC','Winston-Salem, NC',
  'Fayetteville, NC','Cary, NC','Wilmington, NC','High Point, NC','Concord, NC',
  // Michigan
  'Detroit, MI','Grand Rapids, MI','Warren, MI','Sterling Heights, MI','Ann Arbor, MI',
  'Lansing, MI','Flint, MI','Dearborn, MI','Livonia, MI','Westland, MI',
  // New Jersey
  'Newark, NJ','Jersey City, NJ','Paterson, NJ','Elizabeth, NJ','Clifton, NJ',
  'Trenton, NJ','Camden, NJ','Passaic, NJ','Union City, NJ','Bayonne, NJ',
  // Virginia
  'Virginia Beach, VA','Norfolk, VA','Chesapeake, VA','Richmond, VA','Newport News, VA',
  'Alexandria, VA','Hampton, VA','Roanoke, VA','Portsmouth, VA','Suffolk, VA',
  // Washington
  'Seattle, WA','Spokane, WA','Tacoma, WA','Vancouver, WA','Bellevue, WA',
  'Kent, WA','Everett, WA','Renton, WA','Spokane Valley, WA','Yakima, WA',
  // Arizona
  'Phoenix, AZ','Tucson, AZ','Mesa, AZ','Chandler, AZ','Scottsdale, AZ',
  'Glendale, AZ','Gilbert, AZ','Tempe, AZ','Peoria, AZ','Surprise, AZ',
  'Goodyear, AZ','Avondale, AZ','Flagstaff, AZ','Buckeye, AZ','Lake Havasu City, AZ',
  // Massachusetts
  'Boston, MA','Worcester, MA','Springfield, MA','Lowell, MA','Cambridge, MA',
  'New Bedford, MA','Brockton, MA','Quincy, MA','Lynn, MA','Fall River, MA',
  // Tennessee
  'Memphis, TN','Nashville, TN','Knoxville, TN','Chattanooga, TN','Clarksville, TN',
  'Murfreesboro, TN','Franklin, TN','Jackson, TN','Johnson City, TN','Kingsport, TN',
  // Indiana
  'Indianapolis, IN','Fort Wayne, IN','Evansville, IN','South Bend, IN','Carmel, IN',
  'Fishers, IN','Bloomington, IN','Hammond, IN','Gary, IN','Muncie, IN',
  // Missouri
  'Kansas City, MO','St. Louis, MO','Springfield, MO','Columbia, MO','Independence, MO',
  'Lee\'s Summit, MO','O\'Fallon, MO','St. Joseph, MO','St. Charles, MO','St. Peters, MO',
  // Maryland
  'Baltimore, MD','Frederick, MD','Rockville, MD','Gaithersburg, MD','Bowie, MD',
  'Hagerstown, MD','Annapolis, MD','College Park, MD','Salisbury, MD','Laurel, MD',
  // Wisconsin
  'Milwaukee, WI','Madison, WI','Green Bay, WI','Kenosha, WI','Racine, WI',
  'Appleton, WI','Waukesha, WI','Oshkosh, WI','Eau Claire, WI','Janesville, WI',
  // Colorado
  'Denver, CO','Colorado Springs, CO','Aurora, CO','Fort Collins, CO','Lakewood, CO',
  'Thornton, CO','Arvada, CO','Westminster, CO','Pueblo, CO','Centennial, CO',
  // Minnesota
  'Minneapolis, MN','St. Paul, MN','Rochester, MN','Duluth, MN','Bloomington, MN',
  'Brooklyn Park, MN','Plymouth, MN','Maple Grove, MN','Woodbury, MN','St. Cloud, MN',
  // Nevada
  'Las Vegas, NV','Henderson, NV','Reno, NV','North Las Vegas, NV','Sparks, NV',
  'Carson City, NV','Fernley, NV','Elko, NV','Mesquite, NV','Boulder City, NV',
  // Oregon
  'Portland, OR','Salem, OR','Eugene, OR','Gresham, OR','Hillsboro, OR',
  'Beaverton, OR','Bend, OR','Medford, OR','Springfield, OR','Corvallis, OR',
  // South Carolina
  'Columbia, SC','Charleston, SC','North Charleston, SC','Mount Pleasant, SC','Rock Hill, SC',
  'Greenville, SC','Summerville, SC','Goose Creek, SC','Hilton Head Island, SC','Sumter, SC',
  // Alabama
  'Birmingham, AL','Montgomery, AL','Huntsville, AL','Mobile, AL','Tuscaloosa, AL',
  'Hoover, AL','Dothan, AL','Auburn, AL','Decatur, AL','Madison, AL',
  // Louisiana
  'New Orleans, LA','Baton Rouge, LA','Shreveport, LA','Metairie, LA','Lafayette, LA',
  'Lake Charles, LA','Kenner, LA','Bossier City, LA','Monroe, LA','Alexandria, LA',
  // Kentucky
  'Louisville, KY','Lexington, KY','Bowling Green, KY','Owensboro, KY','Covington, KY',
  'Hopkinsville, KY','Richmond, KY','Florence, KY','Georgetown, KY','Henderson, KY',
  // Oklahoma
  'Oklahoma City, OK','Tulsa, OK','Norman, OK','Broken Arrow, OK','Lawton, OK',
  'Edmond, OK','Moore, OK','Midwest City, OK','Enid, OK','Stillwater, OK',
  // Connecticut
  'Bridgeport, CT','New Haven, CT','Stamford, CT','Hartford, CT','Waterbury, CT',
  'Norwalk, CT','Danbury, CT','New Britain, CT','Bristol, CT','Meriden, CT',
  // Utah
  'Salt Lake City, UT','West Valley City, UT','Provo, UT','West Jordan, UT','Orem, UT',
  'Sandy, UT','Ogden, UT','St. George, UT','Layton, UT','South Jordan, UT',
  // Iowa
  'Des Moines, IA','Cedar Rapids, IA','Davenport, IA','Sioux City, IA','Iowa City, IA',
  'Waterloo, IA','Council Bluffs, IA','Ames, IA','West Des Moines, IA','Dubuque, IA',
  // Kansas
  'Wichita, KS','Overland Park, KS','Kansas City, KS','Olathe, KS','Topeka, KS',
  'Lawrence, KS','Shawnee, KS','Manhattan, KS','Lenexa, KS','Salina, KS',
  // Mississippi
  'Jackson, MS','Gulfport, MS','Southaven, MS','Hattiesburg, MS','Biloxi, MS',
  // Arkansas
  'Little Rock, AR','Fort Smith, AR','Fayetteville, AR','Springdale, AR','Jonesboro, AR',
  // Nebraska
  'Omaha, NE','Lincoln, NE','Bellevue, NE','Grand Island, NE','Kearney, NE',
  // New Mexico
  'Albuquerque, NM','Las Cruces, NM','Rio Rancho, NM','Santa Fe, NM','Roswell, NM',
  // Idaho
  'Boise, ID','Meridian, ID','Nampa, ID','Idaho Falls, ID','Pocatello, ID',
  // Hawaii
  'Honolulu, HI','Pearl City, HI','Hilo, HI','Kailua, HI','Waipahu, HI',
  // New Hampshire
  'Manchester, NH','Nashua, NH','Concord, NH','Derry, NH','Dover, NH',
  // Maine
  'Portland, ME','Lewiston, ME','Bangor, ME','South Portland, ME','Auburn, ME',
  // Montana
  'Billings, MT','Missoula, MT','Great Falls, MT','Bozeman, MT','Butte, MT',
  // Rhode Island
  'Providence, RI','Cranston, RI','Woonsocket, RI','Pawtucket, RI','East Providence, RI',
  // Delaware
  'Wilmington, DE','Dover, DE','Newark, DE','Middletown, DE','Smyrna, DE',
  // South Dakota
  'Sioux Falls, SD','Rapid City, SD','Aberdeen, SD','Brookings, SD','Watertown, SD',
  // North Dakota
  'Fargo, ND','Bismarck, ND','Grand Forks, ND','Minot, ND','West Fargo, ND',
  // West Virginia
  'Charleston, WV','Huntington, WV','Parkersburg, WV','Morgantown, WV','Wheeling, WV',
  // Vermont
  'Burlington, VT','South Burlington, VT','Rutland, VT','Essex Junction, VT','Barre, VT',
  // Wyoming
  'Cheyenne, WY','Casper, WY','Laramie, WY','Gillette, WY','Rock Springs, WY',
  // Alaska
  'Anchorage, AK','Fairbanks, AK','Juneau, AK','Sitka, AK','Ketchikan, AK',
].map(c => ({ value: c, label: c }))

// ─── Large niche list ─────────────────────────────────────────────────────────

const NICHES_RAW = [
  // Food & Beverage
  'Food Trucks','Restaurants','Cafes & Coffee Shops','Bakeries','Pizza Places',
  'Sushi Restaurants','Mexican Restaurants','Chinese Restaurants','Thai Restaurants',
  'Indian Restaurants','Italian Restaurants','Burger Joints','Sandwich Shops',
  'Ice Cream Shops','Juice Bars','Food Catering','Meal Prep Services',
  // Home Services
  'Plumbing','HVAC','Roofing','Landscaping','Lawn Care','Tree Services',
  'Pressure Washing','Window Cleaning','Gutter Cleaning','Pool Cleaning',
  'Pest Control','Cleaning Services','Maid Services','Handymen','Painters',
  'Electricians','Carpet Cleaning','Junk Removal','Moving Companies',
  'Fence Installation','Deck Building','Patio Contractors','Foundation Repair',
  'Waterproofing','Chimney Sweep','Dryer Vent Cleaning','Appliance Repair',
  // Auto
  'Auto Repair','Auto Body Shops','Car Washes','Oil Change Shops','Tire Shops',
  'Auto Detailing','Towing Services','Windshield Repair','Auto Glass','Transmission Repair',
  // Beauty & Personal Care
  'Hair Salons','Barbershops','Nail Salons','Spas','Massage Therapy',
  'Eyebrow Threading','Waxing Salons','Tattoo Shops','Piercing Studios',
  'Tanning Salons','Lash Studios','Microblading','Permanent Makeup',
  // Health & Fitness
  'Gyms','Personal Trainers','Yoga Studios','Pilates Studios','CrossFit Gyms',
  'Martial Arts','Boxing Gyms','Dance Studios','Swim Schools',
  // Medical & Dental
  'Dentists','Orthodontists','Chiropractors','Physical Therapy','Optometrists',
  'Dermatologists','Veterinarians','Pet Grooming','Animal Hospitals',
  // Professional Services
  'Accountants','Tax Services','Lawyers','Real Estate Agents','Insurance Agents',
  'Financial Advisors','Mortgage Brokers','Notary Services','Private Investigators',
  // Education
  'Tutoring Centers','Driving Schools','Music Lessons','Art Classes',
  'Language Schools','Daycare Centers','Preschools',
  // Retail & Other
  'Florists','Photographers','Videographers','Event Planners','Wedding Planners',
  'Caterers','DJs','Party Rentals','Printing Services','Sign Shops',
  'Locksmiths','Security Systems','Solar Installation','Concrete Contractors',
  'Asphalt Paving','Dumpster Rental','Storage Units','Boat Repair',
  'Motorcycle Repair','Bicycle Shops','Shoe Repair','Dry Cleaners','Tailors',
].map(n => ({ value: n, label: n }))

// ─── Select styles (fixed — no menuIsOpen on indicator to avoid glitch) ───────

const makeSelectStyles = (minH = '42px') => ({
  control: (b, s) => ({
    ...b,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${s.isFocused ? 'rgba(139,92,246,0.65)' : 'rgba(255,255,255,0.09)'}`,
    borderRadius: '10px',
    boxShadow: s.isFocused ? '0 0 0 3px rgba(139,92,246,0.1)' : 'none',
    minHeight: minH,
    cursor: 'text',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    '&:hover': { borderColor: 'rgba(139,92,246,0.4)' },
  }),
  menuPortal: b => ({ ...b, zIndex: 9999 }),
  menu: b => ({
    ...b,
    background: '#111118',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
    zIndex: 9999,
    overflow: 'hidden',
  }),
  menuList: b => ({
    ...b,
    padding: '6px',
    maxHeight: 260,
    overflowY: 'auto',
    '::-webkit-scrollbar': { width: '3px' },
    '::-webkit-scrollbar-thumb': { background: 'rgba(139,92,246,0.35)', borderRadius: '2px' },
  }),
  option: (b, s) => ({
    ...b,
    background: s.isSelected
      ? 'rgba(139,92,246,0.18)'
      : s.isFocused
      ? 'rgba(139,92,246,0.08)'
      : 'transparent',
    color: s.isSelected ? '#c4b5fd' : s.isFocused ? '#d4d4d8' : '#71717a',
    borderRadius: '7px',
    fontSize: '0.875rem',
    padding: '9px 12px',
    cursor: 'pointer',
    transition: 'background 0.12s, color 0.12s',
  }),
  singleValue: b => ({ ...b, color: '#f4f4f5', fontSize: '0.9rem' }),
  placeholder: b => ({ ...b, color: '#3f3f46', fontSize: '0.9rem' }),
  input: b => ({ ...b, color: '#fff', fontSize: '0.9rem' }),
  indicatorSeparator: () => ({ display: 'none' }),
  // Fixed: no dynamic transform based on menuIsOpen (was causing re-render glitch)
  dropdownIndicator: b => ({
    ...b,
    color: '#3f3f46',
    paddingRight: '12px',
    transition: 'color 0.2s',
    '&:hover': { color: '#8b5cf6' },
  }),
  clearIndicator: b => ({
    ...b,
    color: '#3f3f46',
    padding: '0 6px',
    cursor: 'pointer',
    '&:hover': { color: '#f87171' },
  }),
  noOptionsMessage: b => ({ ...b, color: '#3f3f46', fontSize: '0.85rem', padding: '12px' }),
})

const selectStyles = makeSelectStyles()

const STAGES = ['New Lead', 'Contacted', 'Interested', 'Proposal Sent', 'Closed Won', 'Closed Lost']
const STAGE_STYLE = {
  'New Lead':      { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)',  color: '#818cf8' },
  'Contacted':     { bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',  color: '#fb923c' },
  'Interested':    { bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)',   color: '#eab308' },
  'Proposal Sent': { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  color: '#a78bfa' },
  'Closed Won':    { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  color: '#4ade80' },
  'Closed Lost':   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
}
const scoreColor = s => s >= 85 ? '#4ade80' : s >= 70 ? '#fb923c' : '#f87171'

// ─── Particle Canvas ──────────────────────────────────────────────────────────

function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let id
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const pts = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.0 + 0.2, s: Math.random() * 0.2 + 0.04,
      o: Math.random() * 0.13 + 0.03,
      hue: Math.random() > 0.5 ? '139,92,246' : '99,102,241',
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.y -= p.s
        if (p.y < -2) { p.y = canvas.height + 2; p.x = Math.random() * canvas.width }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.hue},${p.o})`; ctx.fill()
      })
      id = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}

// ─── Scrape Animation ─────────────────────────────────────────────────────────

function ScrapeAnimation({ job, query, location, jobId, onDismiss }) {
  const [dots, setDots] = useState(0)
  const [scanLine, setScanLine] = useState(0)
  const [visibleCompany, setVisibleCompany] = useState(null)
  const [companyVisible, setCompanyVisible] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [displayEta, setDisplayEta] = useState(null)
  const prevCount = useRef(0)
  const ticker = useRef(null)

  const isRunning  = job?.status === 'queued' || job?.status === 'running'
  const isDone     = job?.status === 'done'
  const isStopped  = job?.status === 'stopped'
  const isError    = job?.status === 'error'
  const isFinished = isDone || isStopped || isError
  const progress   = job?.progress ?? 0
  const companies  = job?.found_companies || []
  const foundCount = job?.found_count ?? 0

  useEffect(() => { if (!isRunning) return; const t = setInterval(() => setDots(d => (d+1)%4), 400); return () => clearInterval(t) }, [isRunning])
  useEffect(() => { if (!isRunning) return; const t = setInterval(() => setScanLine(p => (p+1.4)%100), 28); return () => clearInterval(t) }, [isRunning])
  useEffect(() => { if (job?.eta_seconds != null && isRunning) setDisplayEta(job.eta_seconds) }, [job?.eta_seconds, isRunning])

  useEffect(() => {
    if (!isRunning || companies.length === 0 || companies.length <= prevCount.current) return
    const latest = companies[companies.length - 1]
    prevCount.current = companies.length
    clearTimeout(ticker.current)
    setCompanyVisible(false)
    setTimeout(() => { setVisibleCompany(latest); setCompanyVisible(true) }, 150)
    ticker.current = setTimeout(() => setCompanyVisible(false), 2500)
  }, [companies.length, isRunning])

  useEffect(() => () => clearTimeout(ticker.current), [])

  const handleStop = () => {
    if (!jobId || stopping) return
    setStopping(true)
    fetch(`${API}/scrape/stop/${jobId}`, { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  const formatEta = s => s == null ? '—' : s <= 0 ? 'finishing...' : s < 60 ? `~${s}s` : `~${Math.ceil(s/60)}m`

  const stages = [
    { label: 'Launch browser', pct: 10 },
    { label: 'Load Maps',      pct: 20 },
    { label: 'Scroll results', pct: 45 },
    { label: 'Extract data',   pct: 70 },
    { label: 'Save to DB',     pct: 86 },
  ]
  const currentStage = stages.reduce((acc, s) => progress >= s.pct ? s : acc, stages[0])
  const borderColor = isDone ? 'rgba(74,222,128,0.2)' : isStopped ? 'rgba(251,146,60,0.2)' : isError ? 'rgba(248,113,113,0.2)' : 'rgba(139,92,246,0.18)'
  const bgColor     = isDone ? 'rgba(74,222,128,0.03)' : isStopped ? 'rgba(251,146,60,0.03)' : isError ? 'rgba(248,113,113,0.03)' : 'rgba(139,92,246,0.03)'
  const shimmerC    = isDone ? 'rgba(74,222,128,0.7)' : isStopped ? 'rgba(251,146,60,0.7)' : isError ? 'rgba(248,113,113,0.7)' : 'rgba(139,92,246,0.8)'

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: bgColor, border: `1px solid ${borderColor}`, transition: 'all 0.4s ease' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${shimmerC}, transparent)` }} />
      <div style={{ padding: '20px 22px' }}>
        {isRunning && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(139,92,246,0.25)', animation: 'scrapeRipple 1.6s ease-out infinite' }} />
                  <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', background: '#8b5cf6' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd' }}>Scanning{'.'.repeat(dots)}</div>
                  <div style={{ fontSize: 11, color: '#3f3f46', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{query?.value} · {location?.value}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#e4e4e7', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{foundCount}</div>
                  <div style={{ fontSize: 9, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>found</div>
                </div>
                <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, color: displayEta != null && displayEta < 15 ? '#4ade80' : displayEta != null && displayEta < 30 ? '#fb923c' : '#e4e4e7' }}>
                    {formatEta(displayEta)}
                  </div>
                  <div style={{ fontSize: 9, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>remaining</div>
                </div>
                <button onClick={handleStop} disabled={stopping}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: stopping ? 'rgba(255,255,255,0.02)' : 'rgba(248,113,113,0.08)', border: `1px solid ${stopping ? 'rgba(255,255,255,0.06)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 8, padding: '6px 12px', color: stopping ? '#3f3f46' : '#f87171', fontSize: 12, fontWeight: 600, cursor: stopping ? 'not-allowed' : 'pointer', fontFamily: "'Outfit', sans-serif", transition: 'all 0.2s' }}
                  onMouseEnter={e => { if (!stopping) e.currentTarget.style.background = 'rgba(248,113,113,0.14)' }}
                  onMouseLeave={e => { if (!stopping) e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}>
                  <Square size={10} fill={stopping ? '#3f3f46' : '#f87171'} />
                  {stopping ? 'Stopping...' : 'Stop'}
                </button>
              </div>
            </div>

            <div style={{ position: 'relative', height: 88, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(139,92,246,0.1)', marginBottom: 14 }}>
              {[25,50,75].map(x => <div key={x} style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(139,92,246,0.07)' }} />)}
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(139,92,246,0.07)' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${scanLine}%`, width: 2, background: 'linear-gradient(180deg, transparent, rgba(139,92,246,0.9) 50%, transparent)', boxShadow: '0 0 10px rgba(139,92,246,0.5)', transition: 'left 0.028s linear' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: companyVisible ? 1 : 0, transform: companyVisible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
                {visibleCompany && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7', textShadow: '0 0 20px rgba(139,92,246,0.8)', maxWidth: '80%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{visibleCompany.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      {visibleCompany.phone && <span style={{ fontSize: 10, color: '#52525b', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 3 }}><PhoneCall size={8} />{visibleCompany.phone}</span>}
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: visibleCompany.has_website ? 'rgba(139,92,246,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${visibleCompany.has_website ? 'rgba(139,92,246,0.25)' : 'rgba(248,113,113,0.25)'}`, color: visibleCompany.has_website ? '#a78bfa' : '#f87171', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 3 }}>
                        {visibleCompany.has_website ? <><Globe size={7} /> HAS SITE</> : <><AlertTriangle size={7} /> NO SITE</>}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div style={{ position: 'absolute', bottom: 6, left: 10, fontSize: 9, color: '#4c1d95', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>{currentStage.label}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#3f3f46', fontFamily: "'JetBrains Mono', monospace" }}>{job?.message || 'Initialising...'}</span>
                <span style={{ fontSize: 11, color: '#8b5cf6', fontFamily: "'JetBrains Mono', monospace" }}>{progress}%</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', width: `${progress}%`, transition: 'width 0.8s ease', boxShadow: '0 0 8px rgba(139,92,246,0.5)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {stages.map(s => {
                const done = progress > s.pct
                const current = currentStage.label === s.label
                return (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 10, background: done ? 'rgba(139,92,246,0.12)' : current ? 'rgba(139,92,246,0.06)' : 'transparent', border: `1px solid ${done ? 'rgba(139,92,246,0.22)' : current ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)'}`, color: done ? '#a78bfa' : current ? '#7c3aed' : '#27272a', fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.3s' }}>
                    {done ? <CheckCheck size={8} /> : current ? <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1.2s infinite' }} /> : <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#27272a' }} />}
                    {s.label}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {isFinished && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: isDone ? 'rgba(74,222,128,0.1)' : isStopped ? 'rgba(251,146,60,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${isDone ? 'rgba(74,222,128,0.25)' : isStopped ? 'rgba(251,146,60,0.25)' : 'rgba(248,113,113,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDone ? <CheckCircle2 size={16} color="#4ade80" strokeWidth={1.5} /> : isStopped ? <Square size={14} color="#fb923c" fill="#fb923c" /> : <X size={16} color="#f87171" strokeWidth={1.5} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: isDone ? '#4ade80' : isStopped ? '#fb923c' : '#f87171' }}>
                  {isDone ? 'Scrape complete!' : isStopped ? 'Stopped — results saved' : 'Scrape failed'}
                </div>
                <div style={{ fontSize: 12, color: '#52525b', maxWidth: 460 }}>{job?.message}</div>
              </div>
            </div>
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', padding: 6, display: 'flex', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#71717a'} onMouseLeave={e => e.currentTarget.style.color = '#3f3f46'}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stage Dropdown ───────────────────────────────────────────────────────────

function StageDropdown({ lead, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const s = STAGE_STYLE[lead.pipeline_stage] || STAGE_STYLE['New Lead']

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: '4px 10px', fontSize: 11, color: s.color, fontFamily: "'JetBrains Mono', monospace", userSelect: 'none' }}>
        {lead.pipeline_stage || 'New Lead'}
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 4, minWidth: 130, boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
          {STAGES.map(stage => {
            const c = STAGE_STYLE[stage]
            const active = stage === (lead.pipeline_stage || 'New Lead')
            return (
              <div key={stage} onClick={() => { onChange(lead.id, stage); setOpen(false) }}
                style={{ padding: '8px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: active ? c.color : '#71717a', background: active ? c.bg : 'transparent', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                {active ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                {stage}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Batch Results ────────────────────────────────────────────────────────────

function BatchResults({ batchId, onClose }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [leads, setLeads] = useState([])

  useEffect(() => {
    if (!batchId) return
    fetch(`${API}/batches/${batchId}/leads`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d.batch); setLeads(d.leads || []) })
      .catch(() => {})
  }, [batchId])

  const changeStage = (id, stage) => setLeads(prev => prev.map(l => l.id === id ? { ...l, pipeline_stage: stage } : l))

  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 16, height: 16, border: '2px solid rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const noSite = leads.filter(l => l.website_status === 'NO WEBSITE').length

  return (
    <div style={{ animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <CheckCircle2 size={15} color="#4ade80" strokeWidth={1.5} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>Scrape complete</span>
            <span style={{ fontSize: 13, color: '#3f3f46' }}>·</span>
            <span style={{ fontSize: 13, color: '#71717a' }}>{data.query} · {data.location}</span>
          </div>
          <div style={{ fontSize: 12, color: '#3f3f46', fontFamily: "'JetBrains Mono', monospace" }}>
            {leads.length} leads · {noSite} without a website
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/batches')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '7px 14px', color: '#a78bfa', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit', sans-serif', transition: 'background 0.15s'" }} onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,0.14)'} onMouseLeave={e => e.currentTarget.style.background='rgba(139,92,246,0.08)'}>
            View in Batches <ArrowRight size={12} />
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3f3f46', padding: 6, display: 'flex' }} onMouseEnter={e => e.currentTarget.style.color='#71717a'} onMouseLeave={e => e.currentTarget.style.color='#3f3f46'}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(74,222,128,0.4),transparent)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr', gap: 16, padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          {['Business','Website','Score','Status','Phone'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>{h}</div>
          ))}
        </div>
        {leads.map(lead => {
          const noSiteL = lead.website_status === 'NO WEBSITE'
          const filled = Math.round(((lead.score || 0) / 100) * 5)
          return (
            <div key={lead.id}
              style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr', alignItems: 'center', gap: 16, padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'transparent', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: noSiteL ? 'rgba(248,113,113,0.08)' : 'rgba(139,92,246,0.08)', border: `1px solid ${noSiteL ? 'rgba(248,113,113,0.18)' : 'rgba(139,92,246,0.18)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {noSiteL ? <AlertTriangle size={12} color="#f87171" strokeWidth={1.5} /> : <ExternalLink size={12} color="#8b5cf6" strokeWidth={1.5} />}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 20, background: noSiteL ? 'rgba(248,113,113,0.1)' : 'rgba(139,92,246,0.1)', border: `1px solid ${noSiteL ? 'rgba(248,113,113,0.22)' : 'rgba(139,92,246,0.22)'}`, color: noSiteL ? '#f87171' : '#a78bfa', fontFamily: "'JetBrains Mono', monospace", display: 'inline-block' }}>
                {noSiteL ? 'NO SITE' : 'HAS SITE'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={12} strokeWidth={1.5} style={{ color: i <= filled ? scoreColor(lead.score||0) : 'rgba(255,255,255,0.1)', fill: i <= filled ? scoreColor(lead.score||0) : 'transparent' }} />
                ))}
                <span style={{ fontSize: 11, color: scoreColor(lead.score||0), fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, marginLeft: 4 }}>{lead.score||0}</span>
              </div>
              <StageDropdown lead={lead} onChange={changeStage} />
              <span style={{ fontSize: 11, color: '#3f3f46', fontFamily: "'JetBrains Mono', monospace" }}>{lead.phone || '—'}</span>
            </div>
          )
        })}
        <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#3f3f46', fontFamily: "'JetBrains Mono', monospace" }}>{leads.length} leads</span>
          <button onClick={() => navigate('/batches')} style={{ fontSize: 11, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
            view all batches <ArrowRight size={10} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Previous Batches sidebar ─────────────────────────────────────────────────

function PreviousBatches({ batches, loading }) {
  const navigate = useNavigate()

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 14, height: 14, border: '2px solid rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (batches.length === 0) return (
    <div style={{ padding: '20px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: '#27272a', fontFamily: "'JetBrains Mono', monospace" }}>No previous batches yet</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {batches.slice(0, 6).map(b => {
        const date = b.created_at ? new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
        const filledStars = Math.round((b.avg_score / 100) * 5)
        return (
          <div key={b.id} onClick={() => navigate('/batches')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(139,92,246,0.06)'; e.currentTarget.style.borderColor='rgba(139,92,246,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.05)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={12} color="#8b5cf6" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.query}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: '#52525b', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={9} />{b.location}</span>
                <span style={{ fontSize: 10, color: '#27272a' }}>·</span>
                <span style={{ fontSize: 11, color: '#3f3f46', fontFamily: "'JetBrains Mono', monospace" }}>{b.lead_count}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 1 }}>
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={9} strokeWidth={1.5} style={{ color: i <= filledStars ? scoreColor(b.avg_score) : 'rgba(255,255,255,0.08)', fill: i <= filledStars ? scoreColor(b.avg_score) : 'transparent' }} />
                ))}
              </div>
              <span style={{ fontSize: 10, color: '#27272a', fontFamily: "'JetBrains Mono', monospace" }}>{date}</span>
            </div>
          </div>
        )
      })}
      {batches.length > 6 && (
        <button onClick={() => navigate('/batches')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: 'none', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 10, padding: '9px', color: '#3f3f46', fontSize: 12, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(139,92,246,0.2)'; e.currentTarget.style.color='#a78bfa' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; e.currentTarget.style.color='#3f3f46' }}>
          +{batches.length - 6} more <ChevronRight size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Leads() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [batches, setBatches]               = useState([])
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [totalLeads, setTotalLeads]         = useState(0)

  const [scrapeQuery, setScrapeQuery]           = useState(null)
  const [scrapeLocation, setScrapeLocation]     = useState(null)
  const [noWebOnly, setNoWebOnly]               = useState(false)
  const [dupWarning, setDupWarning]             = useState(null)
  const [job, setJob]                           = useState(null)
  const [jobId, setJobId]                       = useState(null)
  const [completedBatchId, setCompletedBatchId] = useState(null)
  const [showResults, setShowResults]           = useState(false)
  const pollRef                                 = useRef(null)

  const fetchBatches = useCallback(() => {
    fetch(`${API}/batches`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : []
        setBatches(arr)
        setTotalLeads(arr.reduce((sum, b) => sum + (b.lead_count || 0), 0))
        setLoadingBatches(false)
      })
      .catch(() => setLoadingBatches(false))
  }, [])

  useEffect(() => { fetchBatches() }, [fetchBatches])

  // Dup detection
  useEffect(() => {
    if (!scrapeQuery || !scrapeLocation) { setDupWarning(null); return }
    const match = batches.find(
      b => b.query.toLowerCase() === scrapeQuery.value.toLowerCase() &&
           b.location.toLowerCase() === scrapeLocation.value.toLowerCase()
    )
    setDupWarning(match || null)
  }, [scrapeQuery, scrapeLocation, batches])

  // Poll
  useEffect(() => {
    if (!jobId) return
    const poll = () => {
      fetch(`${API}/scrape/status/${jobId}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          setJob(data)
          if (data.status === 'done' || data.status === 'stopped') {
            clearInterval(pollRef.current)
            fetchBatches()
            setTimeout(() => {
              fetch(`${API}/batches`, { credentials: 'include' })
                .then(r => r.json())
                .then(arr => {
                  if (!Array.isArray(arr)) return
                  const match = arr.find(
                    b => b.query.toLowerCase() === scrapeQuery?.value?.toLowerCase() &&
                         b.location.toLowerCase() === scrapeLocation?.value?.toLowerCase()
                  )
                  if (match) { setCompletedBatchId(match.id); setShowResults(true) }
                })
            }, 800)
          }
          if (data.status === 'error') clearInterval(pollRef.current)
        })
        .catch(() => {})
    }
    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => clearInterval(pollRef.current)
  }, [jobId])

  const handleScrape = () => {
    if (!scrapeQuery || !scrapeLocation) return
    setJob({ status: 'queued', message: 'Job queued...', progress: 0 })
    setShowResults(false)
    setCompletedBatchId(null)

    fetch(`${API}/scrape/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query: scrapeQuery.value, location: scrapeLocation.value, no_website_only: noWebOnly }),
    })
      .then(r => r.json())
      .then(data => setJobId(data.job_id))
      .catch(err => setJob({ status: 'error', message: String(err), progress: 0 }))
  }

  const handleDismissJob = () => {
    setJob(null); setJobId(null)
    setScrapeQuery(null); setScrapeLocation(null)
    setDupWarning(null)
  }

  const isScraping  = job?.status === 'queued' || job?.status === 'running'
  const firstName   = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const totalNoSite = batches.reduce((sum, b) => sum + (b.no_site || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#fafafa', fontFamily: "'Outfit', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { scrollbar-width: none; overflow-x: hidden; }
        html::-webkit-scrollbar { display: none; }
        @keyframes fadeUp       { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse        { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
        @keyframes scrapeRipple { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        @keyframes spin         { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .f1{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both}
        .f2{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.13s both}
        .f3{animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.21s both}
        .nav-lnk { background:none;border:none;color:#3f3f46;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;transition:color 0.2s;padding:0; }
        .nav-lnk:hover { color:#a1a1aa; }
        .scan-btn { background:linear-gradient(135deg,#8b5cf6,#6366f1);border:none;border-radius:10px;color:#fff;font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;padding:11px 24px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:opacity 0.2s,transform 0.15s;box-shadow:0 4px 16px rgba(139,92,246,0.3); }
        .scan-btn:hover:not(:disabled) { opacity:0.88;transform:translateY(-1px);box-shadow:0 8px 24px rgba(139,92,246,0.4); }
        .scan-btn:disabled { opacity:0.35;cursor:not-allowed;transform:none; }
      `}</style>

      <ParticleCanvas />
      <div style={{ position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:0.35,backgroundImage:'linear-gradient(rgba(139,92,246,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.045) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'radial-gradient(ellipse 100% 55% at 50% 0%,black 0%,transparent 100%)' }} />
      <div style={{ position:'fixed',top:-180,left:'50%',transform:'translateX(-50%)',width:900,height:500,zIndex:0,pointerEvents:'none',background:'radial-gradient(ellipse at center,rgba(139,92,246,0.09) 0%,transparent 70%)' }} />

      {/* NAV */}
      <nav style={{ position:'sticky',top:0,zIndex:100,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 48px',height:64,background:'rgba(9,9,15,0.82)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:32 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer' }} onClick={() => navigate('/')}>
            <div style={{ width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#8b5cf6,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:900,color:'#fff' }}>B</div>
            <span style={{ fontWeight:800,fontSize:'1rem',letterSpacing:'-0.5px',color:'#f4f4f5' }}>BizScout</span>
          </div>
          <div style={{ display:'flex',gap:24 }}>
            <button className="nav-lnk" style={{ color:'#fafafa',fontWeight:600 }}>Leads</button>
            <button className="nav-lnk" onClick={() => navigate('/batches')}>Batches</button>
            <button className="nav-lnk" onClick={() => navigate('/pipeline')}>Pipeline</button>
          <button className="nav-lnk" onClick={() => navigate('/analytics')}>Analytics</button>
          </div>
        </div>
        <NavbarDropdown />
      </nav>

      {/* CONTENT */}
      <div style={{ position:'relative',zIndex:1,maxWidth:1280,margin:'0 auto',padding:'48px 48px 80px',display:'grid',gridTemplateColumns:'1fr 300px',gap:32,alignItems:'start' }}>

        {/* LEFT */}
        <div>
          {/* Header */}
          <div className="f1" style={{ marginBottom:32 }}>
            <div style={{ display:'inline-flex',alignItems:'center',gap:7,background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.18)',borderRadius:6,padding:'4px 12px',marginBottom:14 }}>
              <div style={{ width:5,height:5,borderRadius:'50%',background:'#8b5cf6',animation:'pulse 1.5s infinite' }} />
              <span style={{ color:'#a78bfa',fontSize:'0.64rem',fontWeight:700,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace" }}>Lead Intelligence</span>
            </div>
            <h1 style={{ fontSize:'clamp(1.8rem,3vw,2.6rem)',fontWeight:900,letterSpacing:'-1.5px',color:'#fafafa',marginBottom:6 }}>
              Welcome back, {firstName}.
            </h1>
            <p style={{ color:'#52525b',fontSize:15,lineHeight:1.6 }}>
              {batches.length === 0
                ? 'Run your first search to start finding leads.'
                : <>{totalLeads} leads across {batches.length} {batches.length===1?'batch':'batches'} · <span style={{ color:'#f87171',fontWeight:600 }}>{totalNoSite} without a website</span></>
              }
            </p>
          </div>

          {/* Scraper section */}
          <div className="f2" style={{ marginBottom: 28 }}>
            {/* Active animation */}
            {job && (
              <div style={{ marginBottom: showResults ? 24 : 0 }}>
                <ScrapeAnimation job={job} query={scrapeQuery} location={scrapeLocation} jobId={jobId} onDismiss={handleDismissJob} />
              </div>
            )}

            {/* Form — hide while scraping or showing results */}
            {!isScraping && !showResults && (
              <div style={{ background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:18,overflow:'hidden',position:'relative' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent)' }} />
                <div style={{ padding:'28px 28px 24px' }}>
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:18,fontWeight:800,color:'#fafafa',letterSpacing:'-0.5px',marginBottom:5 }}>New Search</div>
                    <div style={{ fontSize:13,color:'#3f3f46' }}>Type to search any city or business niche</div>
                  </div>

                  <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                      <div>
                        <div style={{ fontSize:10,fontWeight:700,color:'#3f3f46',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace",marginBottom:7 }}>Business Niche</div>
                        <Select
                          options={NICHES_RAW}
                          styles={selectStyles}
                          placeholder="e.g. Food Trucks, Plumbing..."
                          value={scrapeQuery}
                          onChange={setScrapeQuery}
                          isClearable
                          isSearchable
                          filterOption={(option, input) =>
                            input ? option.label.toLowerCase().includes(input.toLowerCase()) : true
                          }
                          noOptionsMessage={() => 'No matching niches'}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                        />
                      </div>
                      <div>
                        <div style={{ fontSize:10,fontWeight:700,color:'#3f3f46',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:"'JetBrains Mono',monospace",marginBottom:7 }}>City</div>
                        <Select
                          options={CITIES_RAW}
                          styles={selectStyles}
                          placeholder="e.g. Sacramento, CA..."
                          value={scrapeLocation}
                          onChange={setScrapeLocation}
                          isClearable
                          isSearchable
                          filterOption={(option, input) =>
                            input ? option.label.toLowerCase().includes(input.toLowerCase()) : true
                          }
                          noOptionsMessage={() => 'No matching cities'}
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                        />
                      </div>
                    </div>

                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                      <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none',fontSize:13,color:'#71717a' }}>
                        <input type="checkbox" checked={noWebOnly} onChange={e => setNoWebOnly(e.target.checked)} style={{ accentColor:'#8b5cf6',width:14,height:14 }} />
                        No website leads only
                      </label>
                      <button className="scan-btn" onClick={handleScrape} disabled={!scrapeQuery || !scrapeLocation}>
                        <Search size={14} /> Scan for leads
                      </button>
                    </div>

                    {/* Dup warning */}
                    {dupWarning && (
                      <div style={{ display:'flex',alignItems:'center',gap:10,background:'rgba(251,146,60,0.06)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:10,padding:'10px 14px' }}>
                        <AlertCircle size={14} color="#fb923c" strokeWidth={1.5} style={{ flexShrink:0 }} />
                        <div style={{ flex:1,fontSize:13,color:'#71717a' }}>
                          <span style={{ color:'#fb923c',fontWeight:600 }}>Already scraped. </span>
                          {dupWarning.query} · {dupWarning.location} has {dupWarning.lead_count} leads. New results will append.
                        </div>
                        <button onClick={() => navigate('/batches')} style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(251,146,60,0.1)',border:'1px solid rgba(251,146,60,0.2)',borderRadius:7,padding:'5px 10px',color:'#fb923c',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif",whiteSpace:'nowrap' }}>
                          View <ArrowRight size={11} />
                        </button>
                      </div>
                    )}

                    <p style={{ fontSize:11,color:'#27272a',fontFamily:"'JetBrains Mono',monospace",margin:0 }}>
                      Headless Chrome · 1–3 min · Duplicates skipped automatically
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {showResults && completedBatchId && !isScraping && (
              <BatchResults
                batchId={completedBatchId}
                onClose={() => { setShowResults(false); setJob(null); setJobId(null); setScrapeQuery(null); setScrapeLocation(null) }}
              />
            )}
          </div>

          {/* Stats */}
          <div className="f3" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12 }}>
            {[
              { icon: Users,    label:'Total Leads',  value:totalLeads,   accent:'#8b5cf6', sub: batches.length>0 ? `${batches.length} batches` : 'No searches yet' },
              { icon: Target,   label:'No Website',   value:totalNoSite,  accent:'#f87171', sub: totalLeads>0 ? `${Math.round(totalNoSite/totalLeads*100)}% of leads` : '—' },
              { icon: BarChart2, label:'Avg Score',   value: batches.length ? Math.round(batches.reduce((a,b)=>a+b.avg_score,0)/batches.length)||'—' : '—', accent:'#4ade80', sub: batches.length>0 ? `${batches.length} runs` : '—' },
            ].map(s => (
              <div key={s.label} style={{ background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:12,padding:'16px 18px',position:'relative',overflow:'hidden' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${s.accent}40,transparent)` }} />
                <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                  <div style={{ width:30,height:30,borderRadius:8,background:`${s.accent}18`,border:`1px solid ${s.accent}30`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    <s.icon size={13} color={s.accent} strokeWidth={1.5} />
                  </div>
                  <span style={{ fontSize:10,color:'#3f3f46',textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:"'JetBrains Mono',monospace" }}>{s.label}</span>
                </div>
                <div style={{ fontSize:26,fontWeight:800,color:'#fafafa',letterSpacing:'-1px',fontFamily:"'JetBrains Mono',monospace" }}>{s.value}</div>
                {s.sub && <div style={{ fontSize:11,color:'#3f3f46',marginTop:3,display:'flex',alignItems:'center',gap:3 }}><ArrowUpRight size={10} color="#4ade80" />{s.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — batches sidebar */}
        <div className="f2" style={{ position:'sticky',top:88 }}>
          <div style={{ background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:16,overflow:'hidden',position:'relative' }}>
            <div style={{ position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,rgba(139,92,246,0.4),transparent)' }} />
            <div style={{ padding:'16px 16px 8px' }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
                <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                  <Layers size={13} color="#8b5cf6" strokeWidth={1.5} />
                  <span style={{ fontSize:13,fontWeight:700,color:'#e4e4e7' }}>Previous Batches</span>
                  {batches.length>0 && (
                    <span style={{ fontSize:10,background:'rgba(139,92,246,0.12)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:20,padding:'2px 7px',color:'#a78bfa',fontFamily:"'JetBrains Mono',monospace" }}>{batches.length}</span>
                  )}
                </div>
                <button onClick={() => navigate('/batches')} style={{ display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',color:'#3f3f46',fontSize:11,fontFamily:"'Outfit',sans-serif",transition:'color 0.2s' }} onMouseEnter={e=>e.currentTarget.style.color='#a78bfa'} onMouseLeave={e=>e.currentTarget.style.color='#3f3f46'}>
                  View all <ChevronRight size={11} />
                </button>
              </div>
              <PreviousBatches batches={batches} loading={loadingBatches} />
            </div>
            <div style={{ padding:'10px 16px 14px' }}>
              <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                <div style={{ width:5,height:5,borderRadius:'50%',background:isScraping?'#fb923c':'#8b5cf6',animation:'pulse 1.5s infinite' }} />
                <span style={{ fontSize:10,color:'#27272a',fontFamily:"'JetBrains Mono',monospace" }}>{isScraping?'Scraping live...':'Live data'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}