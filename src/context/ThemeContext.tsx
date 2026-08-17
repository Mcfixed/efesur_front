// src/context/ThemeContext.tsx
import { createContext, useState, useEffect, useContext } from 'react';
import type { ReactNode } from 'react';

interface ThemeContextType {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        // Inicializar desde localStorage o, si no hay preferencia guardada
        // (p.ej. ventana de incógnito), usar dark por defecto
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            return storedTheme as 'light' | 'dark';
        }
        return 'dark';
    });

    useEffect(() => {
        // Apply or remove the 'dark' class on the HTML element
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        // Save the theme preference to localStorage
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};