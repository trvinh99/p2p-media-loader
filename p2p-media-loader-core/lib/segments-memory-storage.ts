/**
 * Copyright 2019 Novage LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Segment } from "./loader-interface";
import { SegmentsStorage } from "./hybrid-loader";

export class SegmentsMemoryStorage implements SegmentsStorage {
    private cache = new Map<string, { segment: Segment; lastAccessed: number }>();

    constructor(
        private settings: {
            cachedSegmentExpiration: number;
            cachedSegmentsCount: number;
        }
    ) {}

    public storeSegment = async (segment: Segment): Promise<void> => {
        console.log("STORE SEGMENT: " + JSON.stringify(segment));
        const buffer = Buffer.from(segment.data!);

         const base64String = buffer.toString('base64');
         console.log("DATA: " + base64String);
         var url_split = segment.id.split('/');
         console.log("url_split: " + url_split);
         window.localStorage.setItem(url_split.pop()!, base64String);
        this.cache.set(segment.id, { segment, lastAccessed: performance.now() });
    };

    public getSegmentsMap = async (): Promise<Map<string, { segment: Segment }>> => {
        console.log("CACHE: " + JSON.stringify(this.cache));
        return this.cache;
    };

    public getSegment = async (id: string): Promise<Segment | undefined> => {
        const cacheItem = this.cache.get(id);
        console.log("ID: " + id);
        console.log("CACHE ITEM: " + JSON.stringify(cacheItem));

        if (cacheItem === undefined) {
            return undefined;
        }

        cacheItem.lastAccessed = performance.now();
        return cacheItem.segment;
    };

    public hasSegment = async (id: string): Promise<boolean> => {
        return this.cache.has(id);
    };

    public clean = async (masterSwarmId: string, lockedSegmentsFilter?: (id: string) => boolean): Promise<boolean> => {
        const segmentsToDelete: string[] = [];
        const remainingSegments: { segment: Segment; lastAccessed: number }[] = [];

        // Delete old segments
        const now = performance.now();

        for (const cachedSegment of this.cache.values()) {
            if (now - cachedSegment.lastAccessed > this.settings.cachedSegmentExpiration) {
                segmentsToDelete.push(cachedSegment.segment.id);
            } else {
                remainingSegments.push(cachedSegment);
            }
        }

        // Delete segments over cached count
        let countOverhead = remainingSegments.length - this.settings.cachedSegmentsCount;
        if (countOverhead > 0) {
            remainingSegments.sort((a, b) => a.lastAccessed - b.lastAccessed);

            for (const cachedSegment of remainingSegments) {
                if (lockedSegmentsFilter === undefined || !lockedSegmentsFilter(cachedSegment.segment.id)) {
                    segmentsToDelete.push(cachedSegment.segment.id);
                    countOverhead--;
                    if (countOverhead === 0) {
                        break;
                    }
                }
            }
        }

        segmentsToDelete.forEach((id) => this.cache.delete(id));
        return segmentsToDelete.length > 0;
    };

    public destroy = async (): Promise<void> => {
        this.cache.clear();
    };
}
