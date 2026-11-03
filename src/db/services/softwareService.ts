import { db } from '../index.ts';
import { serviceSoftwareOrders } from '../schema.ts';
import { desc, eq, and, or, ilike } from 'drizzle-orm';

export interface CreateServicePayload {
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  deviceImei?: string;
  deviceColor?: string;
  issueType: string;
  issueDetails?: string;
  toolsUsed?: string;
  toolCost?: number;
  estimatedCost: number;
  downPayment?: number;
  technicianUid?: string;
  technicianNotes?: string;
}

export async function createServiceOrder(payload: CreateServicePayload) {
  try {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderNumber = `SRV-${dateStr}-${randomSuffix}`;

    const downPayment = payload.downPayment ?? 0;
    const estimatedCost = payload.estimatedCost;
    const finalCost = estimatedCost;
    const balanceDue = Math.max(0, finalCost - downPayment);

    const [order] = await db
      .insert(serviceSoftwareOrders)
      .values({
        orderNumber,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        deviceModel: payload.deviceModel,
        deviceImei: payload.deviceImei || null,
        deviceColor: payload.deviceColor || null,
        issueType: payload.issueType,
        issueDetails: payload.issueDetails || null,
        toolsUsed: payload.toolsUsed || null,
        toolCost: payload.toolCost ?? 0,
        estimatedCost,
        finalCost,
        downPayment,
        balanceDue,
        status: 'received',
        technicianUid: payload.technicianUid || null,
        technicianNotes: payload.technicianNotes || null,
      })
      .returning();

    return order;
  } catch (error) {
    console.error('Failed to create service software order:', error);
    throw new Error('Gagal mencatat penerimaan servis software HP', { cause: error });
  }
}

export async function getServiceOrders(filter?: {
  status?: string;
  search?: string;
  limit?: number;
}) {
  try {
    const conditions = [];

    if (filter?.status && filter.status !== 'all') {
      conditions.push(eq(serviceSoftwareOrders.status, filter.status));
    }

    if (filter?.search) {
      const q = `%${filter.search}%`;
      conditions.push(
        or(
          ilike(serviceSoftwareOrders.orderNumber, q),
          ilike(serviceSoftwareOrders.customerName, q),
          ilike(serviceSoftwareOrders.customerPhone, q),
          ilike(serviceSoftwareOrders.deviceModel, q),
          ilike(serviceSoftwareOrders.deviceImei, q)
        )
      );
    }

    const query = db
      .select()
      .from(serviceSoftwareOrders)
      .orderBy(desc(serviceSoftwareOrders.id))
      .limit(filter?.limit ?? 50);

    return conditions.length > 0 ? await query.where(and(...conditions)) : await query;
  } catch (error) {
    console.error('Failed to get service orders:', error);
    throw new Error('Gagal mengambil daftar antrean servis', { cause: error });
  }
}

export async function getServiceOrderById(id: number) {
  if (typeof id !== 'number' || isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
    return null;
  }
  try {
    const [order] = await db
      .select()
      .from(serviceSoftwareOrders)
      .where(eq(serviceSoftwareOrders.id, id));

    return order || null;
  } catch (error) {
    console.error('Failed to get service order by id:', error);
    throw new Error('Gagal mengambil detail servis', { cause: error });
  }
}

export async function updateServiceStatus(id: number, update: {
  status: string; // 'received' | 'in_progress' | 'completed' | 'picked_up' | 'cancelled_failed'
  toolsUsed?: string;
  toolCost?: number;
  finalCost?: number;
  balanceDue?: number;
  technicianNotes?: string;
}) {
  if (typeof id !== 'number' || isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
    throw new Error('Pesanan servis tidak ditemukan');
  }
  try {
    const [existing] = await db.select().from(serviceSoftwareOrders).where(eq(serviceSoftwareOrders.id, id));
    if (!existing) throw new Error('Pesanan servis tidak ditemukan');

    const updateFields: Record<string, any> = {
      status: update.status,
    };

    if (update.toolsUsed !== undefined) updateFields.toolsUsed = update.toolsUsed;
    if (update.toolCost !== undefined) updateFields.toolCost = update.toolCost;
    if (update.technicianNotes !== undefined) updateFields.technicianNotes = update.technicianNotes;

    const finalCost = update.finalCost !== undefined ? update.finalCost : existing.finalCost;
    updateFields.finalCost = finalCost;

    if (update.status === 'completed') {
      updateFields.completedAt = new Date();
      updateFields.balanceDue = Math.max(0, finalCost - existing.downPayment);
    } else if (update.status === 'picked_up') {
      updateFields.pickedUpAt = new Date();
      updateFields.balanceDue = 0; // lunas saat diambil
    } else if (update.balanceDue !== undefined) {
      updateFields.balanceDue = update.balanceDue;
    }

    const [updated] = await db
      .update(serviceSoftwareOrders)
      .set(updateFields)
      .where(eq(serviceSoftwareOrders.id, id))
      .returning();

    return updated;
  } catch (error) {
    console.error('Failed to update service status:', error);
    throw new Error('Gagal memperbarui status servis', { cause: error });
  }
}

export async function deleteServiceOrder(id: number, orderNumber?: string) {
  try {
    const isIdValid = typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= 2147483647;
    let condition;
    if (orderNumber && isIdValid) {
      condition = or(eq(serviceSoftwareOrders.id, id), eq(serviceSoftwareOrders.orderNumber, orderNumber));
    } else if (orderNumber) {
      condition = eq(serviceSoftwareOrders.orderNumber, orderNumber);
    } else if (isIdValid) {
      condition = eq(serviceSoftwareOrders.id, id);
    } else {
      return null;
    }

    const [deleted] = await db
      .delete(serviceSoftwareOrders)
      .where(condition)
      .returning();
    return deleted || null;
  } catch (error) {
    console.error('Failed to delete service order:', error);
    throw new Error('Gagal menghapus nota servis software', { cause: error });
  }
}
