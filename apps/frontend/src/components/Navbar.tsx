function Navbar() {
  return (
    <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          <span className="text-sm font-semibold text-violet-400">
            ◈
          </span>
        </div>

        <span className="text-sm font-semibold tracking-wide">
          Codebase Navigator
        </span>
      </div>

      {/* Navigation */}
      <button
        type="button"
        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        Sign In
      </button>
    </nav>
  );
}

export default Navbar;