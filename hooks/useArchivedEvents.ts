import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CalendarEvent } from '../types';
import { eventConverter } from '../converters';

export const useArchivedEvents = (enabled: boolean, year: number) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!enabled) {
            setEvents([]);
            return;
        }

        const fetchArchived = async () => {
            setLoading(true);
            setError(null);
            try {
                // Query: Events ending in the target year
                // We use YYYY-01-01 to YYYY-12-31 based on endDate
                const startStr = `${year}-01-01`;
                const endStr = `${year}-12-31`;

                // Note: 'archived_events' collection might need an index on endDate
                const q = query(
                    collection(db, 'archived_events').withConverter(eventConverter),
                    where('endDate', '>=', startStr),
                    where('endDate', '<=', endStr)
                );

                const snapshot = await getDocs(q);
                const loaded = snapshot.docs.map(doc => ({
                    ...doc.data(),
                    isArchived: true, // Mark as archived for UI styling
                    // Ensure ID matches doc ID just in case
                    id: doc.id
                }));
                setEvents(loaded);
            } catch (err: any) {
                console.error("Failed to fetch archived events", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchArchived();
    }, [enabled, year]);

    return { events, loading, error };
};
