-- INSTRUCCIONES PARA AGREGAR EL ROL "VIEWER" (VISUALIZADOR)
-- Ejecuta este script en el SQL Editor de Supabase.

-- 1. Asegurarse de que el usuario 'mitoleomito3@gmail.com' tenga el rol 'viewer'.
--    NOTA: El usuario debe haberse registrado ya en la aplicación para que exista en la tabla 'profiles'.
UPDATE public.profiles
SET role = 'viewer'
WHERE email = 'mitoleomito3@gmail.com';

-- 2. Verificación (Opcional)
SELECT * FROM public.profiles WHERE email = 'mitoleomito3@gmail.com';

-- 3. (Avanzado) Si deseas restringir estrictamente la inserción de datos a nivel de base de datos
--    para que los 'viewers' no puedan insertar ni siquiera hackeando la API:

/*
-- Eliminar política anterior permisiva
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;

-- Crear política estricta: Solo Admins o Sellers pueden insertar
CREATE POLICY "Sellers and Admins can insert sales" ON public.sales FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by AND (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'seller')
  )
);
*/
