import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full hover:bg-background-overlay relative"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 transition-all scale-100 rotate-0 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 transition-all scale-0 rotate-90 dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
