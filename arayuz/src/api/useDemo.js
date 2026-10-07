// Demo (donanımsız deneme) düğmeleri yalnız mock sunucuda görünür (api.demoVarMi).
import { useEffect, useState } from 'react'

export function useDemo(api) {
  const [var_, setVar] = useState(false)
  useEffect(() => {
    let iptal = false
    api.demoVarMi().then((v) => { if (!iptal) setVar(v) })
    return () => { iptal = true }
  }, [api])
  return var_
}
