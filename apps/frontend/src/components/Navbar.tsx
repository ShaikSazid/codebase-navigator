function Navbar() {
  return (
    <header className="w-full shrink-0">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        {/* Brand */}
        <a href="/" className="group flex items-center gap-2.5">
          <span className="text-[17px] leading-none text-[#D4A359] transition-transform duration-500 group-hover:rotate-90">
            ◈
          </span>
          <span className="text-[14px] font-medium tracking-tight text-[#EAE7E0]">
            Codebase Navigator
          </span>
        </a>
      </nav>
    </header>
  );
}

export default Navbar;