// Foto pequena de uma skin (ou skate), desenhada uma vez e guardada.
import { useEffect, useState } from 'react';
import { thumb } from './thumbs.js';

export default function SkinThumb({ kind = 'skin', id, className = '' }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    thumb(kind, id).then((u) => live && setUrl(u)).catch(() => {});
    return () => { live = false; };
  }, [kind, id]);
  return url ? <img src={url} alt="" draggable={false} className={className} /> : <span className={'skin-thumb-wait ' + className} />;
}
