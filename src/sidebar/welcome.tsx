import { ReactNode } from 'react';

export default function Welcome(): ReactNode {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4">
            <h1 className="text-2xl font-bold mb-4">Welcome to the Game Boundary Configurator</h1>
            <p className="text-lg mb-6">
                This tool allows you to define and export game boundaries for your projects.
            </p>
            <p className="text-sm text-gray-500 mb-4">
                Please select options from the sidebar to get started.
            </p>
            <img src="/logo.png" alt="Logo" className="w-32 h-32 mb-4" />
        </div>
    );
}