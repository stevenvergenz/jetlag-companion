import { ReactNode } from 'react';

export default function Welcome(): ReactNode {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4">
            <h2>Hide+Seek Explorer</h2>
            <p>Use this tool to find transit stations in the selected area that match your criteria.</p>
            <p>
                This tool uses <a target="_blank" href="https://www.openstreetmap.org/">OpenStreetMap</a>,
                an open-source GIS database, for transit information. If you find incorrect or incomplete information
                for your area, they welcome your additions! This tool itself is open-source on
                <a target="_blank" href="https://github.com/stevenvergenz/jetlag-companion">GitHub</a>,
                feel free to submit improvements there!
            </p>
            <p>Let's start with defining your game boundaries. Press "Next" to continue.</p>
        </div>
    );
}