import React, { useState, useEffect } from 'react';
import {
  Search,
  ClipboardList,
  Play,
  ArrowRight,
  ChevronDown,
  Menu,
  X,
  Calendar,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import doctorsPhoto from '../../assets/doctors.jpg';
import { Department, Doctor, Appointment } from '../../types/index.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { ServicesDropdown } from '../../components/ServicesDropdown.js';
import { BookingModal } from '../../components/BookingModal.js';
import { MyAppointmentsModal } from '../../components/MyAppointmentsModal.js';
import { AuthModal } from '../../components/AuthModal.js';
import { ToastContainer, ToastMessage } from '../../components/Toast.js';
import { HospitalLogo } from '../../components/HospitalLogo.js';

export const LandingPage: React.FC = () => {
  const { user, logout } = useAuth();

  // Navigation and Modals state
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [myAppointmentsOpen, setMyAppointmentsOpen] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>();
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // Catalog data
  const [departments, setDepartments] = useState<Department[]>([]);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  const openBookingForDepartment = (dept: Department) => {
    setSelectedDeptId(dept.id);
    setBookingModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#C9D8F8] py-8 sm:py-12 px-3 sm:px-6 lg:px-8 relative overflow-hidden font-sans text-slate-900 selection:bg-[#1E4ED8] selection:text-white">
      {/* =====================================================================
          TITLE ON BLUE CANVAS ABOVE CARD (§12 spec)
          "Hospital UI" / "With online doctor consultation"
          ===================================================================== */}
      <div className="max-w-6xl mx-auto mb-6 sm:mb-8 text-center sm:text-left">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1B2B4B]">
          MEDI BOOK
        </h2>
        <p className="text-sm sm:text-base font-semibold text-[#1E4ED8] mt-0.5 tracking-wide">
          With online doctor consultation
        </p>
      </div>

      {/* =====================================================================
          FLOATING 3D DECOR OUTSIDE CARD (CSS/SVG, not photos §12 spec)
          - top-left: white glossy capsule ~140×55 rotated -28°
          - top-right: dark royal-blue sphere, bottom-left quarter visible
          - right edge: two-tone capsule (white left / --primary right) rotated +38°
          - motion: pills float ±8px / 6s staggered
          ===================================================================== */}
      <div className="hidden lg:block pointer-events-none select-none">
        {/* Top-Left Glossy Capsule */}
        <div
          className="absolute -top-4 left-6 xl:left-24 w-[140px] h-[55px] rounded-full rotate-[-28deg] shadow-2xl z-20 transition-transform duration-1000"
          style={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 50%, #DBEAFE 100%)',
            boxShadow: '0 20px 40px rgba(30,78,216,0.18), inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -2px 6px rgba(191,219,254,0.6)',
            animation: 'floatY 6s ease-in-out infinite',
          }}
        >
          {/* Gloss highlight */}
          <div className="absolute top-2 left-4 w-16 h-2 rounded-full bg-white/80 blur-[0.5px]"></div>
        </div>

        {/* Top-Right Dark Royal-Blue Sphere (bottom-left quarter visible) */}
        <div
          className="absolute -top-16 -right-16 w-52 h-52 rounded-full z-0 transition-transform duration-1000"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #2563EB 0%, #1E4ED8 45%, #102A83 85%, #0B1B54 100%)',
            boxShadow: '0 30px 60px rgba(11,27,84,0.3)',
            animation: 'floatY 6s ease-in-out infinite 3s',
          }}
        >
          <div className="absolute inset-0 rounded-full bg-linear-to-b from-white/20 to-transparent"></div>
        </div>

        {/* Right Edge Two-Tone Capsule (white left / --primary right) rotated +38° */}
        <div
          className="absolute top-[48%] -right-10 w-[130px] h-[52px] rounded-full rotate-[38deg] shadow-2xl z-20 flex overflow-hidden border border-white/50"
          style={{
            boxShadow: '0 25px 45px rgba(30,78,216,0.22)',
            animation: 'floatY 6s ease-in-out infinite 1.5s',
          }}
        >
          <div className="w-1/2 h-full bg-white relative">
            <div className="absolute top-1.5 left-2 w-7 h-1.5 rounded-full bg-white blur-[0.3px]"></div>
          </div>
          <div className="w-1/2 h-full bg-[#1E4ED8] relative">
            <div className="absolute top-1.5 right-2 w-7 h-1.5 rounded-full bg-white/40 blur-[0.3px]"></div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN CARD CONTAINER: White rounded card (#F7F8FC)
          --card-shadow: 0 40px 80px rgba(37,99,235,.12)
          ===================================================================== */}
      <main className="max-w-6xl mx-auto bg-[#F7F8FC] rounded-3xl sm:rounded-[36px] shadow-[0_40px_80px_rgba(37,99,235,0.14)] border border-white/80 p-5 sm:p-8 lg:p-12 relative z-10">
        {/* ===================================================================
            NAVBAR INSIDE CARD (§12 spec)
            "Hospital logo" left · Home/Services▾/Doctors/About us/Contact us center
            (Home active --primary) · Sign in (filled) + Sign up (outlined)
            =================================================================== */}
        <header className="relative flex items-center justify-between pb-6 sm:pb-10 border-b border-slate-200/50">
          {/* Logo Left: Minimalist vector logo with cupped hands, dual capsules & MEDIBOOK */}
          <div className="cursor-pointer">
            <HospitalLogo size="md" layout="horizontal" />
          </div>

          {/* Nav Center (Desktop: Home, Services▾, Doctors, About us, Contact us) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs lg:text-sm font-semibold text-[#6B7280]">
            <a
              href="#home"
              className="text-[#1E4ED8] font-bold transition-colors cursor-pointer"
            >
              Home
            </a>

            {/* Services Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setServicesOpen(!servicesOpen)}
                onMouseEnter={() => setServicesOpen(true)}
                className="flex items-center gap-1 hover:text-[#1E4ED8] transition-colors py-2 cursor-pointer"
              >
                <span>Services</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${servicesOpen ? 'rotate-180 text-[#1E4ED8]' : ''}`} />
              </button>

              <ServicesDropdown
                departments={departments}
                isOpen={servicesOpen}
                onSelectDepartment={openBookingForDepartment}
                onClose={() => setServicesOpen(false)}
              />
            </div>

            <button
              onClick={() => {
                setSelectedDeptId(undefined);
                setBookingModalOpen(true);
              }}
              className="hover:text-[#1E4ED8] transition-colors cursor-pointer"
            >
              Doctors
            </button>

            <a
              href="#about"
              onClick={(e) => {
                e.preventDefault();
                addToast('info', 'Hospital care accredited with international clinical excellence standards.');
              }}
              className="hover:text-[#1E4ED8] transition-colors cursor-pointer"
            >
              About us
            </a>

            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                addToast('info', '24/7 Helpline: +91 40 2345 6789 • Emergency Ward Gate 1');
              }}
              className="hover:text-[#1E4ED8] transition-colors cursor-pointer"
            >
              Contact us
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setMyAppointmentsOpen(true)}
                  className="px-3.5 py-2 rounded-full bg-blue-50 hover:bg-blue-100 text-[#1E4ED8] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>My Appointments</span>
                </button>
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <span className="text-xs font-bold text-slate-800 hidden lg:inline">
                    {user.name.split(' ')[0]}
                  </span>
                  <button
                    onClick={async () => {
                      await logout();
                      addToast('info', 'Logged out successfully');
                    }}
                    title="Sign Out"
                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAuthInitialMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#1E4ED8] hover:bg-[#1638B0] text-white text-xs font-bold transition-all duration-150 transform hover:-translate-y-0.5 shadow-md shadow-blue-600/20"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthInitialMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-full border border-[#1E4ED8] text-[#1E4ED8] hover:bg-blue-50 text-xs font-bold transition-all duration-150 transform hover:-translate-y-0.5"
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger menu toggle */}
          <div className="sm:hidden flex items-center gap-2">
            {user && (
              <button
                onClick={() => setMyAppointmentsOpen(true)}
                className="p-2 rounded-full bg-blue-50 text-[#1E4ED8]"
              >
                <Calendar className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Panel */}
        {mobileMenuOpen && (
          <div className="sm:hidden pt-4 pb-3 border-b border-slate-200/60 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setBookingModalOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#1E4ED8]"
            >
              Doctors &amp; Appointments
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setServicesOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#1E4ED8]"
            >
              Departments &amp; Services
            </button>
            {user ? (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-3">
                <span className="text-xs font-bold text-slate-800">{user.name}</span>
                <button
                  onClick={async () => {
                    await logout();
                    setMobileMenuOpen(false);
                    addToast('info', 'Logged out successfully');
                  }}
                  className="text-xs text-rose-600 font-semibold"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthInitialMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="py-2.5 rounded-xl bg-[#1E4ED8] text-white text-xs font-bold text-center"
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthInitialMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="py-2.5 rounded-xl border border-[#1E4ED8] text-[#1E4ED8] text-xs font-bold text-center"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            HERO 2-COLUMN SECTION (§12 spec)
            Desktop 2-col · tablet stack photo · mobile hide pills
            =================================================================== */}
        <section className="pt-8 sm:pt-14 pb-4 sm:pb-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* =================================================================
              HERO LEFT (§12 spec)
              H1 "We care / about your health" (48-56px, 800)
              Body (exact): "Good health is the state of mental, physical and
              social well being and it does not just mean absence of diseases."
              CTAs: `Book an appointment →` pill + play-circle `Watch videos`
              Footer: "Become member of our hospital community? Sign up"
              ================================================================= */}
          <div className="lg:col-span-6 space-y-6 sm:space-y-8">
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#1B2B4B] leading-[1.08] tracking-tight">
              We care <br />
              <span className="text-[#1B2B4B]">about your health</span>
            </h1>

            <p className="text-sm sm:text-base text-[#6B7280] leading-relaxed max-w-lg font-normal">
              Good health is the state of mental, physical and social well being and it does not just mean absence of diseases.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDeptId(undefined);
                  setBookingModalOpen(true);
                }}
                className="px-7 py-3.5 rounded-full bg-[#1E4ED8] hover:bg-[#1638B0] text-white text-sm font-bold transition-all duration-150 transform hover:-translate-y-0.5 shadow-lg shadow-blue-600/25 flex items-center gap-2 group cursor-pointer"
              >
                <span>Book an appointment</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={() => setVideoModalOpen(true)}
                className="flex items-center gap-3 px-5 py-3 rounded-full hover:bg-slate-200/50 text-[#1B2B4B] font-bold text-sm transition-all duration-150 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-[#1E4ED8] border border-slate-100">
                  <Play className="w-4 h-4 fill-[#1E4ED8] ml-0.5" />
                </div>
                <span>Watch videos</span>
              </button>
            </div>

            {/* Footer inside left: "Become member of our hospital community? Sign up" */}
            <div className="pt-4 text-xs sm:text-sm text-[#6B7280]">
              Become member of our hospital community?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthInitialMode('register');
                  setAuthModalOpen(true);
                }}
                className="text-[#1E4ED8] font-bold hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </div>
          </div>

          {/* =================================================================
              HERO RIGHT (§12 spec)
              - 340px circular blue gradient backdrop
              - Two back-to-back PHOTOREAL doctors (East-Asian woman in lab coat,
                Black woman in teal scrubs)
              - Two floating white chips on left overlapping doctor photo:
                1. 🔍 "Well Qualified doctors" / "Treat with care"
                2. 📋 "Book an appointment" / "Online appointment"
              - Hover lift 2px
              ================================================================= */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end relative">
            <div className="relative w-[320px] sm:w-[380px] lg:w-[420px] aspect-square flex items-center justify-center">
              {/* 340px circular blue gradient backdrop */}
              <div
                className="absolute w-[290px] sm:w-[340px] aspect-square rounded-full -z-0"
                style={{
                  background: 'radial-gradient(circle at 40% 40%, #60A5FA 0%, #2563EB 55%, #1E4ED8 100%)',
                  boxShadow: '0 25px 60px rgba(37,99,235,0.22)',
                }}
              ></div>

              {/* Doctors Photoreal Portrait Image */}
              <div className="relative z-10 w-[270px] sm:w-[330px] aspect-square rounded-full overflow-hidden border-4 border-white shadow-xl shadow-blue-900/10">
                <img
                  src={doctorsPhoto}
                  alt="East-Asian female doctor in lab coat and Black female doctor in teal scrubs"
                  className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Floating White Chip 1: 🔍 "Well Qualified doctors" / "Treat with care" */}
              <div
                onClick={() => {
                  setSelectedDeptId(undefined);
                  setBookingModalOpen(true);
                }}
                className="absolute top-8 -left-2 sm:-left-6 lg:-left-8 z-20 bg-white rounded-2xl p-3 sm:p-3.5 shadow-[0_12px_30px_rgba(27,43,75,0.12)] border border-slate-100 flex items-center gap-3 cursor-pointer hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-[#1E4ED8] flex items-center justify-center shrink-0">
                  <Search className="w-5 h-5 text-[#1E4ED8]" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">
                    Well Qualified doctors
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    Treat with care
                  </div>
                </div>
              </div>

              {/* Floating White Chip 2: 📋 "Book an appointment" / "Online appointment" */}
              <div
                onClick={() => {
                  setSelectedDeptId(undefined);
                  setBookingModalOpen(true);
                }}
                className="absolute bottom-8 -left-4 sm:-left-8 lg:-left-10 z-20 bg-white rounded-2xl p-3 sm:p-3.5 shadow-[0_12px_30px_rgba(27,43,75,0.12)] border border-slate-100 flex items-center gap-3 cursor-pointer hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-[#1E4ED8] flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-[#1E4ED8]" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">
                    Book an appointment
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    Online appointment
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Video Modal (for "Watch videos" CTA) */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setVideoModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hospital Tour &amp; Care Overview</h3>
            <p className="text-xs text-slate-500 mb-4">
              Explore our hospital facilities, specialist consultation rooms, and patient-centered digital care.
            </p>
            <div className="aspect-video w-full rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xs relative overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-tr from-blue-900/80 to-transparent flex flex-col items-center justify-center gap-3 p-4 text-center">
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/40">
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </div>
                <span className="font-semibold text-sm">Virtual Consultation &amp; Facility Walkthrough</span>
                <span className="text-[11px] text-blue-200">Dr. Sarah Chen &amp; Dr. Angela Davis</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        isOpen={bookingModalOpen}
        initialDepartmentId={selectedDeptId}
        onClose={() => {
          setBookingModalOpen(false);
          setSelectedDeptId(undefined);
        }}
        onRequestAuth={() => {
          setBookingModalOpen(false);
          setAuthInitialMode('login');
          setAuthModalOpen(true);
        }}
        onAppointmentBooked={(appt) => {
          addToast(
            'success',
            `Appointment scheduled with ${appt.doctorName} for ${new Date(appt.startsAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}`
          );
        }}
      />

      {/* My Appointments Modal */}
      <MyAppointmentsModal
        isOpen={myAppointmentsOpen}
        onClose={() => setMyAppointmentsOpen(false)}
        onBookNew={() => {
          setMyAppointmentsOpen(false);
          setBookingModalOpen(true);
        }}
        onShowToast={addToast}
      />

      {/* Auth Modal (Sign In / Sign Up) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          addToast('success', 'Logged in successfully!');
        }}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
