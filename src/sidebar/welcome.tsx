import { ReactNode } from 'react';

export default function Welcome(): ReactNode {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4">
            <h2>Hide+Seek Explorer</h2>
            <p>Use this tool to find transit stations in the selected area that match your criteria.</p>
            <p>Let's start with defining your game boundaries. Press "Next" to continue.</p>
        </div>
    );
}