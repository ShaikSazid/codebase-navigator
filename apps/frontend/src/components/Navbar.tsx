function Navbar() {
  return (
    <nav className="flex w-full shrink-0 items-center justify-between px-8 py-7 sm:px-14">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#444444]">
          <span className="text-[13px] font-bold text-[#E0E0E0]">◈</span>
        </div>

        <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#E0E0E0]">
          Codebase Navigator
        </span>
      </div>

      <button
        type="button"
        className="rounded-full border border-[#444444] px-4 py-2 text-[12px] text-[#B0B0B0] transition-colors duration-300 hover:border-[#888888] hover:text-[#E0E0E0]"
      >
        Sign in
      </button>
    </nav>
  );
}

export default Navbar;