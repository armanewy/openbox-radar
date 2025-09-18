"use client";
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

export default function FilterDrawer({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:hidden">
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline" className="mb-3">Filters</Button>
        </DrawerTrigger>
        <DrawerContent>
          <div className="overflow-auto h-full">
            <DrawerHeader>
              <h2 className="text-lg font-semibold">Filters</h2>
              <DrawerClose asChild>
                <Button variant="outline" size="sm">Close</Button>
              </DrawerClose>
            </DrawerHeader>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
