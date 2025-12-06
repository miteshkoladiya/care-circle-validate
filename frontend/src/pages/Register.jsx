import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Heart,
  User,
  Mail,
  Lock,
  Phone,
  Calendar,
  UserCheck,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "Patient",
  age: "",
    gender: "",
    contactNumber: "",
  registrationNumber: "",
    termsAccepted: false,
    doctorDocument: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();

  const handleInputChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Please ensure your passwords match",
        variant: "destructive",
      });
      return;
    }
    if (!formData.termsAccepted) {
      toast({
        title: "Terms required",
        description: "Please accept the terms and conditions",
        variant: "destructive",
      });
      return;
    }
    if (formData.role === "Doctor" && !formData.doctorDocument) {
      toast({
        title: "Document required",
        description: "Please upload your medical degree or license",
        variant: "destructive",
      });
      return;
    }

    // client-side validations
    const ageVal = Number(formData.age);
    if (formData.age && (isNaN(ageVal) || ageVal < 1 || ageVal > 150)) {
      toast({ title: 'Invalid age', description: 'Age must be between 1 and 150', variant: 'destructive' });
      return;
    }
    const digits = String(formData.contactNumber).replace(/\D/g, '');
    if (!digits || digits.length !== 10) {
      toast({ title: 'Invalid contact', description: 'Contact number must contain 10 digits', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        age: formData.age,
        gender: formData.gender,
        contactNumber: formData.contactNumber,
        registrationNumber: formData.registrationNumber,
      };

      await auth.register(payload, formData.doctorDocument);

      toast({
        title: "Account created successfully!",
        description:
          formData.role === "Doctor"
            ? "Your doctor account is pending verification by our admin team. You can sign in after approval."
            : "Welcome to CareCircle! You can now sign in.",
      });

      // IMPORTANT CHANGE: never auto‑redirect doctors to dashboard
      if (formData.role === "Patient") {
        // Patients can go straight to dashboard if token is present
        if (auth.token) navigate("/dashboard");
        else navigate("/login");
      } else {
        // Doctors (and admins, if any) always go to login
        navigate("/login");
      }
    } catch (err) {
      toast({
        title: "Registration failed",
        description: err?.message || "Unable to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4 py-12">
      <div className="w-full max-w-2xl space-y-6 px-4 sm:px-6">
        <div className="text-center">
          <div className="flex justify-center items-center space-x-2 mb-4">
            <Heart className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">CareCircle</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Join our community
          </h1>
          <p className="text-muted-foreground">
            Create your healthcare community account
          </p>
        </div>

        <Card className="shadow-healthcare">
          <CardHeader>
            <CardTitle className="text-xl">Create Account</CardTitle>
            <CardDescription>
              Fill in your details to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        handleInputChange("confirmPassword", e.target.value)
                      }
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Age */}
{/* Age */}
<div className="space-y-2">
  <Label htmlFor="age">Age</Label>
  <div className="relative">
    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
    <Input
      id="age"
      type="number"
      placeholder="25"
      value={formData.age}
      onChange={(e) => handleInputChange("age", e.target.value)}
      className="form-input pl-10"
      min={1}
      max={150}
      required
    />
  </div>
</div>


                {/* Gender */}
                {/* Gender */}
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <RadioGroup
                    value={formData.gender}
                    onValueChange={(value) =>
                      handleInputChange("gender", value)
                    }
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male" />
                      <Label htmlFor="male">Male</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female" />
                      <Label htmlFor="female">Female</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other">Other</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Contact Number */}
              {/* Contact Number */}
<div className="md:col-span-2 space-y-2">
  <Label htmlFor="contactNumber">Contact Number</Label>
  <div className="relative">
    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
    <Input
      id="contactNumber"
      type="tel"
      placeholder="1234567890"
      value={formData.contactNumber}
      onChange={(e) =>
        handleInputChange("contactNumber", e.target.value.replace(/\D/g, ""))
      }
      className="form-input pl-10"
      pattern="[0-9]{10}"
      maxLength={10}
      required
    />
  </div>
  {/* <p className="text-xs text-muted-foreground">
    Must be exactly 10 digits
  </p> */}
</div>


                {/* Registration Number for Doctors */}
                {formData.role === "Doctor" && (
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="registrationNumber">Doctor Registration Number</Label>
                    <div className="relative">
                      <Input
                        id="registrationNumber"
                        type="text"
                        placeholder="Registration / License number"
                        value={formData.registrationNumber}
                        onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                        className="form-input"
                        required={formData.role === "Doctor"}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Account Type */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Account Type
                </Label>
                <RadioGroup
                  value={formData.role}
                  onValueChange={(value) => handleInputChange("role", value)}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="Patient" id="patient-reg" />
                    <Label className="font-normal cursor-pointer flex-1">
                      Patient
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="Doctor" id="doctor-reg" />
                    <Label className="font-normal cursor-pointer flex-1">
                      Doctor
                    </Label>
                  </div>
                </RadioGroup>

                {formData.role === "Doctor" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground bg-accent-light p-3 rounded-lg">
                      <strong>Note:</strong> Doctor accounts require
                      verification by our admin team. You'll be notified once
                      your credentials are verified.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="doctorDocument">
                        Medical Degree/License Document *
                      </Label>
                      <div className="relative">
                        <Upload className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="doctorDocument"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) =>
                            handleInputChange(
                              "doctorDocument",
                              e.target.files?.[0] || null
                            )
                          }
                          className="form-input pl-10 pr-3"
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload your medical degree or medical license (PDF, JPG,
                        PNG - Max 5MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={formData.termsAccepted}
                  onCheckedChange={(checked) =>
                    handleInputChange("termsAccepted", checked)
                  }
                />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the{" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
