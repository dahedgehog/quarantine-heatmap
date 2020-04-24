import { promises } from 'fs';
import { sortBy, prop } from 'ramda';
import axios from 'axios';

const URL = 'https://api.digitransit.fi/geocoding/v1/search';

interface GeoAddress {
  address: string;
  found: string;
  lat: number;
  long: number;
}

const writeGeo = async (geos: GeoAddress[]) => {
  const file = geos.map(geo => `${geo.address},${geo.lat},${geo.long}`).join('\n');
  await promises.writeFile('./data/Geo.csv', file, 'utf8');
};

const readNitor = () => promises.readFile('./data/Nitor.csv', 'utf8');
const splitCsv = (file: string) => file.split('\n');
const splitRow = (row: string) => row.split(',');

(async () => {
  const file = await readNitor();
  const lines = splitCsv(file);
  const rows = lines.map(line => splitRow(line));
  const addresses = rows.filter(row => row[8] === 'FI').map(row => `${row[3]}, ${row[5]}`);

  const geoCoded = await Promise.all(
    addresses.map(async (address: string) => {
      const url = URL.replace('${ADDRESS}', address);
      const res = (
        await axios.get(url, {
          params: {
            text: address,
            size: 1
          },
          timeout: 5000
        })
      ).data;
      const feature = res.features[0];
      return {
        address,
        found: feature.properties.label,
        long: feature.geometry.coordinates[0],
        lat: feature.geometry.coordinates[1]
      } as GeoAddress;
    })
  );

  const failed = geoCoded.filter(geo => geo.address.split(' ')[0] !== geo.found.split(' ')[0]);
  if (failed.length > 0) {
    console.log('Some addresses failed, please fix the input data');
    console.log(failed);
    process.exit(1);
  }

  const sorted = sortBy(prop('address'), geoCoded);
  await writeGeo(sorted);
  console.log(sorted);
})();
