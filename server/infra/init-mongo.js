// Mongo replica-set bootstrap. Runs once per fresh volume via docker compose.
// Idempotent: skips if the set already exists.
try {
  const status = rs.status();
  print(`replica set already initialized (member state: ${status.members[0].stateStr})`);
} catch (err) {
  if (err.codeName === 'NotYetInitialized') {
    // host must be reachable from the developer machine (the app connects from the host)
    rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] });
    print('replica set rs0 initiated (host: localhost:27017)');
  } else {
    throw err;
  }
}
