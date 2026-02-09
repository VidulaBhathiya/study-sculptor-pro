import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, FileQuestion, Library, Users } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminQuestions from "@/components/admin/AdminQuestions";
import AdminResources from "@/components/admin/AdminResources";
import AdminUsers from "@/components/admin/AdminUsers";

export default function AdminPanel() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">Manage your learning platform</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4" />
              <span className="hidden sm:inline">Questions</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-2">
              <Library className="h-4 w-4" />
              <span className="hidden sm:inline">Resources</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminOverview />
          </TabsContent>
          <TabsContent value="questions">
            <AdminQuestions />
          </TabsContent>
          <TabsContent value="resources">
            <AdminResources />
          </TabsContent>
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
