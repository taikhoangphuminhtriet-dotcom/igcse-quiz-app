const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

// Initialize Firebase Admin SDK
if (!getApps().length) {
    const privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDVghmD/0ucqn6d\n4aW1plhz9dottnUen9ycZd17VEABz1WqhhR/pLaW8GuBYhgfq18GZ7WPnDNfm+Gk\nQ9LsrQ3xAiY8bC2XGGzqiWnJXFe6I+YBnhK3Nh1OcvXJAf7J48SOqamMwZL2Dldc\neWC+7Q3cyEu6ObjidJXc7lH13tBxa6QU8qlMpyhU6KlM3WYPHkExZLb9ialO3+v8\nu3XUMg/CFFkOUzCrB4k9g/P2Qu3/lbd//vJLccBAJKi895GWUFnoaZgMu0f7z2ty\nclx5ViOewGcQ8jixf+P1qy/w6LhOACQN64cCd006WPQx/EUpBONME+eZ+Jul5rsw\n+ERn6BtNAgMBAAECggEAEuku0uDwJMx6IghMOeJlt8GpJT7hsUh2DRk9rJCKCc8A\nNrYhByxC6uwZDZDvc5Clfkb9zx5F85w2OGs0ebebQkNPOS9Yu2cTsJNivg3SjF9l\nHjQO0tD1eA8ZI4hsdZvZu0weQyQbHPWoub1bexW6kllgUbqOnGo4ouSt+EHXww/c\n6TLhOw7xy033IGREm4reuhz1rkiJG23ONYiSuzUesqOTLbj/I6aM/kqNgEMJYyAQ\nPVPDWazbGNsfttbdvfJzkNscGOrS7kIgz0UVwy44o7f5gDWiIad1CjcWYT1RjCW1\nUSrpA47R7hfgax62gHf+RRyNrZQR+WbK2sq0RF75iQKBgQD6ipuxO3nvlUzePESD\ngOOdfD6A5NT67qUXdvp0TfKEG5GiRkTYtmHZPAawV/utBb0eTTtCrQqZMdKeAvjY\nEvk8TCn3Kml5bCCe3vzPEHW/zU8OfTyGpFZZffjuC9GXMd4TugZTeD+FArI3jwWY\n25bOgyaPzwZviq1vfx23SoxGNQKBgQDaKPBm/zVdbiFK3f66JQZxsmgemgC03EUf\nMaZ9NOMOoealTdTGVgQBAXnr60Giod16Rtd1NWjT05QBDD3JYwya5qxzpTsiXLLS\nBu7zxPCVTZLD98KDnE1EDSmrfke//PmRoPEzNecN5Bvkj1UcmYckfdRbhkpidowC\nI+X+OLPDuQKBgHcRbJC8PWT5RYDQj5cXqBTuOR40omtnAxq1tq2TZdAW8g126706\nYCJHfr5L8hX2hjxiY+l6J3FK1le1/eFikwRvBfqrM1k7Y/1c6DTYE73Fqu6t4hfy\n/f6l+anYABGk52/klqEQos9pypzQ4c4VfgRDHA54SwyzkV1NwiebzDKJAoGBAMXE\nhSKpyqPXGYE4PBpdRDk/5VmQfIF4iYTcyrQIhKmYJXHHW9Ms2NZckz1GeKrJF/Eo\nVVvgvhYBYNOOWFi/XQbzhHQV3sSoykbRmD8OUpbWyuyyJviOchD16ceYY8zstQXK\no72r6LjUCGErepnBqBxxoVgTJk2acBPknTPYDUapAoGBAIDWZLZLaBMZyjuu53YI\naW5J58EV9QBvA0TIYHsfYrb/XcYhbg1sJd0sLNtpVXnJK2VMqYvQk7Az4G3ouOYd\n+/8e4Nmlo4rFH+aag6/YKG937t1b6PytsejRUE55nQtxrfmjjGYo69i2/HgFVIaI\nbmCKa8lhV6MtP6I5fhWjVdOO\n-----END PRIVATE KEY-----\n";

    initializeApp({
        credential: cert({
            projectId: "live2-8b337",
            clientEmail: "firebase-adminsdk-ghpo7@live2-8b337.iam.gserviceaccount.com",
            privateKey: privateKey,
        }),
        storageBucket: "live2-8b337.firebasestorage.app",
    });
}

const adminDb = getFirestore();
const adminAuth = getAuth();
const adminStorage = getStorage();

module.exports = {
    adminDb,
    adminAuth,
    adminStorage
};
