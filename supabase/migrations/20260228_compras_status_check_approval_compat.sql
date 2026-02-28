-- Phase 2 safety migration:
-- Keep compras status constraint compatible with approval gate statuses used by API v1.
DO $$
BEGIN
  IF to_regclass('public.compras') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.compras'::regclass
      AND conname = 'compras_status_check'
  ) THEN
    ALTER TABLE public.compras DROP CONSTRAINT compras_status_check;
  END IF;

  ALTER TABLE public.compras
    ADD CONSTRAINT compras_status_check CHECK (
      status = ANY (
        ARRAY[
          'Solicitado',
          'Pendente Aprovação Cliente',
          'Revisão Cliente',
          'Aprovado',
          'Pedido',
          'Entregue',
          'Cancelado'
        ]::text[]
      )
    );
END $$;
